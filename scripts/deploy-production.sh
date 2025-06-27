#!/bin/bash

# 🚀 Production Deployment Script
# Deploy current branch to production environment via GitHub Actions

set -e

echo "🚀 Permaweb Glossary Production Deployment"
echo "=========================================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes"
    echo "   Commit your changes first, or they won't be included in the deployment"
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

# Check if main branch is protected (common case)
echo "🔍 Checking deployment options..."
echo
echo "Choose deployment method:"
echo "   1) Create Pull Request to main (recommended)"
echo "   2) Direct push to main (maintainers only)"
echo
read -p "Enter choice (1 or 2): " -n 1 -r
echo

if [[ $REPLY == "1" ]]; then
    # Create PR workflow
    echo "📋 Creating Pull Request for production deployment..."
    echo
    echo "This will:"
    echo "   1. Push current branch to origin"
    echo "   2. Open GitHub to create PR to main"
    echo "   3. Once PR is merged → automatic production deployment"
    echo
    read -p "   Continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled"
        exit 1
    fi
    
    echo "📤 Pushing current branch..."
    git push origin HEAD
    
    # Get repo info for GitHub URL
    REPO_URL=$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\/[^/]*\).*/\1/' | sed 's/\.git$//')
    
    echo "✅ Branch pushed successfully!"
    echo
    echo "🔗 Create your PR here:"
    echo "   https://github.com/$REPO_URL/compare/main...$CURRENT_BRANCH?expand=1"
    echo
    echo "📋 PR will trigger production deployment when merged to main"
    
elif [[ $REPLY == "2" ]]; then
    # Direct push workflow (for maintainers)
    echo "⚠️  DIRECT PUSH TO MAIN - USE WITH CAUTION!"
    echo
    echo "This will:"
    echo "   1. Push current state directly to 'main' branch"
    echo "   2. Trigger immediate production deployment"
    echo "   3. Deploy to: https://glossary.ar.io"
    echo
    read -p "   Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled"
        exit 1
    fi
    
    echo "📤 Pushing directly to main branch..."
    git push origin HEAD:main --force-with-lease
    
    # Get repo info for GitHub URL
    REPO_URL=$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\/[^/]*\).*/\1/' | sed 's/\.git$//')
    
    echo "✅ Production deployment triggered!"
    echo
    echo "🔗 Monitor the deployment at:"
    echo "   https://github.com/$REPO_URL/actions"
    echo
    echo "🌐 Production will be available at:"
    echo "   https://glossary.ar.io"
    
else
    echo "❌ Invalid choice. Cancelled."
    exit 1
fi

echo "⏰ Deployment typically takes 2-3 minutes" 