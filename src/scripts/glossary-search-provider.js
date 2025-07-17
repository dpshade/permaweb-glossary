import { SearchProvider } from './search-provider.js';
import { searchConfig } from './search-config.js';
import { Document } from 'flexsearch';

// Constants for the application, can be moved to config
const GLOSSARY_URL = '/data/glossary.json';

export class GlossarySearchProvider extends SearchProvider {
    constructor() {
        super();
        this.searchIndex = null;
        this.glossaryData = null;
    }

    async initialize() {
        // Load glossary data
        const response = await fetch(GLOSSARY_URL); // Should add timeout from config
        if (!response.ok) {
            throw new Error('Failed to load glossary data');
        }
        
        const data = await response.json();
        this.glossaryData = data.terms || data;

        // Initialize FlexSearch index with optimized configuration
        this.searchIndex = new Document({
            document: {
                id: "id",
                index: [
                    { field: "term", tokenize: "forward", resolution: 9 },
                    { field: "definition", tokenize: "forward", resolution: 5 },
                    { field: "aliases", tokenize: "forward", resolution: 7 },
                    { field: "category", tokenize: "strict", resolution: 3 }
                ],
                store: true
            },
            preset: "score",
            tokenize: "forward",
            cache: 100,
            context: {
                resolution: 3,
                depth: 2,
                bidirectional: true
            }
        });

        const contextMap = this._buildContextMap(this.glossaryData);

        this.glossaryData.forEach((item, index) => {
            const searchableText = item.aliases ? item.aliases.join(' ') : '';
            const relatedTerms = item.related || [];
            const context = contextMap.get(item.term.toLowerCase()) || '';
            
            this.searchIndex.add({
                id: index.toString(),
                term: item.term,
                definition: item.definition + ' ' + context,
                category: item.category,
                aliases: searchableText,
                related: relatedTerms
            });
        });
    }

    async search(query) {
        if (!this.searchIndex) {
            throw new Error('Search index not initialized');
        }

        const cleanQuery = this._cleanSearchQuery(query);
        if (!cleanQuery) {
            return [];
        }

        const queryVariations = this._generateQueryVariations(cleanQuery);
        
        let allResults = [];
        
        const mainResults = this.searchIndex.search(cleanQuery, {
            enrich: true,
            limit: 10,
            suggest: true,
            cache: true
        });
        allResults = [...mainResults];
        
        queryVariations.forEach(variation => {
            if (variation !== cleanQuery) {
                const variationResults = this.searchIndex.search(variation, {
                    enrich: true,
                    limit: 5,
                    suggest: true,
                    cache: true
                });
                allResults = [...allResults, ...variationResults];
            }
        });
        
        const processedResults = this._processSearchResults(allResults, cleanQuery);
        return processedResults;
    }

    destroy() {
        this.searchIndex = null;
        this.glossaryData = null;
        // any other cleanup
    }

    // Private helper methods extracted from main.js
    _cleanSearchQuery(query) {
        return query
            .replace(/[.,\/#!$%\^&\*;:{}=_`~()'"]+$/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _generateQueryVariations(query) {
        if (query.length < 3) return [query];
        const variations = new Set([query]);
        const words = query.toLowerCase().split(/\s+/);
        words.forEach(word => {
            if (word.length < 3) return;
            if (word.endsWith('ing')) variations.add(word.slice(0, -3));
            else if (word.endsWith('ed')) variations.add(word.slice(0, -2));
            else if (word.endsWith('s') && !word.endsWith('ss')) variations.add(word.slice(0, -1));
            else if (word.endsWith('es')) variations.add(word.slice(0, -2));
            else if (word.endsWith('ies')) variations.add(word.slice(0, -3) + 'y');
            const alphaNumericOnly = word.replace(/[^a-z0-9]/g, '');
            if (alphaNumericOnly !== word && alphaNumericOnly.length > 2) {
                variations.add(alphaNumericOnly);
            }
        });
        if (words.length > 1) {
            const stopWords = ['the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'as', 'of'];
            const filteredWords = words.filter(w => !stopWords.includes(w) && w.length > 2);
            if (filteredWords.length > 0 && filteredWords.length !== words.length) {
                variations.add(filteredWords.join(' '));
            }
        }
        return [...variations];
    }

    _processSearchResults(results, query) {
        const flatResults = [];
        const seenIds = new Set();
        const exactTermMatches = [];
        const exactAliasMatches = [];
        const partialMatches = [];
        
        results.forEach(resultSet => {
            resultSet.result.forEach(item => {
                const id = item.id;
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    const glossaryItem = this.glossaryData[parseInt(id)];
                    const verbatimMatchScore = this._checkVerbatimMatch(glossaryItem, query);
                    let score = this._calculateSemanticLikeScore(glossaryItem, query);
                    
                    if (verbatimMatchScore === 2) {
                        exactTermMatches.push({ ...glossaryItem, score: 2.0 });
                    } else if (verbatimMatchScore === 1) {
                        exactAliasMatches.push({ ...glossaryItem, score: 1.5 });
                    } else if (verbatimMatchScore === 0.9) {
                        partialMatches.push({ ...glossaryItem, score: 1.0 + score * 0.1 });
                    } else {
                        flatResults.push({ ...glossaryItem, score: score });
                    }
                }
            });
        });
        
        const combinedResults = [...exactTermMatches, ...exactAliasMatches, ...partialMatches, ...flatResults];
        return combinedResults.sort((a, b) => b.score - a.score).slice(0, 15);
    }
    
    _checkVerbatimMatch(item, query) {
        const queryLower = query.toLowerCase();
        if (item.term.toLowerCase() === queryLower) return 2;
        if (item.aliases && item.aliases.some(alias => alias.toLowerCase() === queryLower)) return 1;
        const termWords = item.term.toLowerCase().split(/[-\s]+/);
        if (termWords.includes(queryLower)) return 0.9;
        return 0;
    }

    _calculateSemanticLikeScore(item, query) {
        const queryLower = query.toLowerCase();
        const termLower = item.term.toLowerCase();
        const defLower = item.definition.toLowerCase();
        
        let exactMatchScore = 0;
        if (termLower === queryLower) exactMatchScore = 1.0;
        else if (termLower.startsWith(queryLower)) exactMatchScore = 0.8;
        else if (termLower.split(/[-\s]+/).includes(queryLower)) exactMatchScore = 0.7;
        else if (termLower.includes(queryLower)) exactMatchScore = 0.6;
        
        let partialMatchScore = 0;
        const queryWords = queryLower.split(/\s+/);
        let wordMatchCount = 0;
        queryWords.forEach(word => { if (word.length > 2 && defLower.includes(word)) wordMatchCount++; });
        if (queryWords.length > 0) partialMatchScore = wordMatchCount / queryWords.length * 0.5;
        
        if (item.aliases && item.aliases.length > 0) {
            const aliasesLower = item.aliases.map(a => a.toLowerCase());
            if (aliasesLower.some(alias => alias === queryLower)) partialMatchScore += 0.4;
            else if (aliasesLower.some(alias => alias.includes(queryLower))) partialMatchScore += 0.3;
        }
        
        let contextMatchScore = 0;
        if (item.related && item.related.length > 0) {
            const relatedLower = item.related.map(r => r.toLowerCase());
            if (relatedLower.some(rel => rel === queryLower)) contextMatchScore += 0.3;
            else if (relatedLower.some(rel => rel.includes(queryLower))) contextMatchScore += 0.2;
        }
        
        const similarity = this._calculateStringSimilarity(termLower, queryLower);
        const fuzzySimilarityScore = similarity * 0.4;
        
        return Math.min(1.0, exactMatchScore + partialMatchScore + contextMatchScore + fuzzySimilarityScore);
    }

    _calculateStringSimilarity(str1, str2) {
        if (Math.abs(str1.length - str2.length) > 5) return 0.1;
        let matches = 0;
        const maxLength = Math.max(str1.length, str2.length);
        for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
            if (str1[i] === str2[i]) matches++;
        }
        return matches / maxLength;
    }

    _buildContextMap(glossaryItems) {
        const termDefs = new Map(glossaryItems.map(item => {
            const pluralForm = item.term + 's';
            const hiddenAliases = [pluralForm];
            if (item.aliases) {
                item.aliases.forEach(alias => { hiddenAliases.push(alias + 's'); });
            }
            return [item.term.toLowerCase(), { definition: item.definition, originalTerm: item.term, hiddenAliases }];
        }));
        
        const contextMap = new Map();
        
        for (const [term, {definition, originalTerm, hiddenAliases}] of termDefs) {
            const relatedTerms = new Set();
            const defLower = definition.toLowerCase();
            for (const [otherTerm, {definition: otherDef}] of termDefs) {
                if (otherTerm === term) continue;
                if (otherDef.toLowerCase().includes(term) || defLower.includes(otherTerm)) {
                    relatedTerms.add(otherTerm);
                }
            }
            const glossaryItem = glossaryItems.find(item => item.term.toLowerCase() === term);
            if (glossaryItem?.related) {
                glossaryItem.related.forEach(relatedTerm => { relatedTerms.add(relatedTerm.toLowerCase()); });
            }
            const contextString = `${definition} ${[...relatedTerms].join(' ')}`;
            contextMap.set(term, contextString);
            hiddenAliases.forEach(alias => { contextMap.set(alias.toLowerCase(), contextString); });
        }
        return contextMap;
    }
} 