#!/bin/bash

# Load environment variables from .env or .env.local
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Run the migration script
node scripts/migrate-project-colors.js
