#!/bin/bash
echo "Building site..."
npm run build

echo "Deploying to S3..."
aws s3 sync _site/ s3://kaden.sacred-symmetry-ai.com --delete --region us-east-1

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id E1503E9K1S3IMT --paths "/*" --region us-east-1

echo "Done! Site: https://kaden.sacred-symmetry-ai.com"
