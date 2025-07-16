#!/bin/bash

# 🔍 Preview Deployment Script  
# Deploy current branch to Vercel preview via GitHub Actions

set -e

echo "🔍 Permaweb Glossary Preview Deployment (Vercel)"
echo "================================================"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes"
    echo "   Commit your changes first, or they won't be included in the preview"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled"
        exit 1
    fi
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
CURRENT_COMMIT=$(git rev-parse HEAD)

echo "📋 Current branch: $CURRENT_BRANCH"
echo "📋 Current commit: ${CURRENT_COMMIT:0:8}"
echo

# Confirm the preview deployment
echo "🚀 This will create a Vercel preview deployment by:"
echo "   1. Pushing current state to 'preview' branch"
echo "   2. Triggering GitHub Actions workflow" 
echo "   3. Deploying to: Vercel (fast preview)"
echo
read -p "   Continue? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo "🔄 Creating preview deployment..."

# Push to preview branch (force push to overwrite)
echo "📤 Pushing to preview branch..."
git push origin HEAD:preview --force-with-lease

echo "✅ Preview deployment triggered!"
echo
echo "🔗 Monitor the deployment at:"
echo "   https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\/[^/]*\).*/\1/' | sed 's/\.git$//')/actions"
echo
echo "🌐 Preview will be available at:"
echo "   https://permaweb-glossary.vercel.app (or assigned Vercel URL)"
echo "   Note: Actual Vercel URL will be shown in GitHub Actions output"
echo
echo "⏰ Deployment typically takes 1-2 minutes (Vercel is faster than Arweave)" 