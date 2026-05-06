#!/bin/bash
echo "Building site..."
npm run build

echo "Deploying to S3..."
aws s3 sync _site/ s3://kaden-mission-web --delete --region us-east-1

echo "Deployment complete!"
