#!/bin/bash

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p 5432 -U postgres; do
  sleep 1
done

echo "PostgreSQL is ready. Running Prisma migrations..."
npx prisma migrate dev --name init

echo "Database setup complete!"