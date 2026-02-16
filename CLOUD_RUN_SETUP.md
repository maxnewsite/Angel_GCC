# Google Cloud Run Deployment Guide

## Prerequisites

1. **Google Cloud Project**
   - Create a project at https://console.cloud.google.com
   - Note your PROJECT_ID

2. **Enable Required APIs**
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

3. **Install Google Cloud SDK**
   - Download from: https://cloud.google.com/sdk/docs/install
   - Authenticate: `gcloud auth login`
   - Set project: `gcloud config set project PROJECT_ID`

## Deployment Options

### Option 1: Automated GitHub Deployment (Recommended)

1. **Connect GitHub Repository**
   - Go to Cloud Build > Triggers
   - Click "Connect Repository"
   - Select GitHub and authenticate
   - Choose your repository: `maxnewsite/angel_gcc`

2. **Create Build Trigger**
   - Name: `deploy-angel-gcc`
   - Event: Push to branch `^main$`
   - Build configuration: Cloud Build configuration file
   - Location: `cloudbuild.yaml`
   - Click "Create"

3. **Set Environment Variables**
   - Go to Cloud Run > angel-gcc service > Edit & Deploy New Revision
   - Add environment variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ANTHROPIC_API_KEY=your_anthropic_api_key
     ```

4. **Push to GitHub**
   - Any push to `main` branch will trigger automatic deployment
   - Monitor progress in Cloud Build > History

### Option 2: Manual Deployment from Local

1. **Build and Deploy**
   ```bash
   # Set your project
   gcloud config set project PROJECT_ID

   # Build the image
   gcloud builds submit --tag gcr.io/PROJECT_ID/angel-gcc

   # Deploy to Cloud Run
   gcloud run deploy angel-gcc \
     --image gcr.io/PROJECT_ID/angel-gcc \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 1Gi \
     --cpu 1 \
     --set-env-vars NODE_ENV=production
   ```

2. **Set Secrets** (for sensitive env vars)
   ```bash
   # Create secrets
   echo -n "your_anthropic_key" | gcloud secrets create anthropic-api-key --data-file=-

   # Grant Cloud Run access
   gcloud secrets add-iam-policy-binding anthropic-api-key \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"

   # Deploy with secrets
   gcloud run deploy angel-gcc \
     --image gcr.io/PROJECT_ID/angel-gcc \
     --update-secrets=ANTHROPIC_API_KEY=anthropic-api-key:latest
   ```

## Environment Variables Required

Set these in Cloud Run service configuration:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic AI
ANTHROPIC_API_KEY=your_anthropic_api_key

# Next.js
NEXT_PUBLIC_APP_URL=https://your-cloudrun-url.run.app
NODE_ENV=production
```

## Custom Domain Setup

1. **Map Custom Domain**
   ```bash
   gcloud run domain-mappings create \
     --service angel-gcc \
     --domain your-domain.com \
     --region us-central1
   ```

2. **Update DNS Records**
   - Add the CNAME records shown in the Cloud Run console
   - Wait for SSL certificate provisioning (automatic)

## Monitoring & Logs

- **View Logs**: Cloud Run > angel-gcc > Logs
- **Metrics**: Cloud Run > angel-gcc > Metrics
- **Health Check**: https://your-service-url.run.app/api/health

## Cost Optimization

- **Minimum instances**: 0 (default) - scales to zero when not in use
- **Maximum instances**: 10 (adjust based on traffic)
- **Memory**: 1Gi (sufficient for Next.js app)
- **CPU**: 1 (1 vCPU)

Cloud Run pricing: Pay only for request time (rounded to nearest 100ms)

## Troubleshooting

1. **Build Fails**
   - Check cloudbuild.yaml syntax
   - Verify Dockerfile builds locally: `docker build -t test .`
   - Check Cloud Build logs

2. **Deployment Fails**
   - Verify environment variables are set
   - Check service account permissions
   - Review Cloud Run logs

3. **Application Errors**
   - Check Cloud Run logs: `gcloud run logs read angel-gcc`
   - Test health endpoint: `curl https://your-url.run.app/api/health`
   - Verify Supabase and Anthropic credentials

## Update Configuration

Edit `cloudbuild.yaml` to modify:
- Region: Change `--region` flag
- Memory/CPU: Adjust `--memory` and `--cpu`
- Scaling: Modify `--min-instances` and `--max-instances`
- Authentication: Change `--allow-unauthenticated` to `--no-allow-unauthenticated`

## Rollback

```bash
# List revisions
gcloud run revisions list --service angel-gcc --region us-central1

# Rollback to previous revision
gcloud run services update-traffic angel-gcc \
  --to-revisions REVISION_NAME=100 \
  --region us-central1
```

## Support

- Cloud Run Documentation: https://cloud.google.com/run/docs
- Cloud Build Documentation: https://cloud.google.com/build/docs
- Pricing Calculator: https://cloud.google.com/products/calculator
