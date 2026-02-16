# 🚀 Deployment Guide: GitHub → Google Cloud Run → bocconiventures.vc/AI

Complete step-by-step guide to deploy your Angel AI Analyst platform.

---

## 📋 Prerequisites

### Required Accounts & Tools
- [ ] GitHub account
- [ ] Google Cloud Platform account (with billing enabled)
- [ ] Git installed locally
- [ ] Google Cloud CLI (`gcloud`) installed
- [ ] Domain access to `bocconiventures.vc`

### Install Google Cloud CLI
```bash
# Windows (PowerShell as Administrator)
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe

# Or download from: https://cloud.google.com/sdk/docs/install
```

---

## 🔐 Step 1: Prepare Environment Variables

### Create `.env.production` file
```bash
# In your project root (angel_gcc/)
cp .env.local.example .env.production
```

### Edit `.env.production` with production values:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
ANTHROPIC_API_KEY=your-production-anthropic-api-key
```

**⚠️ IMPORTANT:** Never commit `.env.production` to GitHub!

---

## 📦 Step 2: Deploy to GitHub

### Initialize Git (if not already done)
```bash
cd C:\Users\spiri\angel_gcc

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Angel AI Analyst platform"
```

### Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `angel-ai-analyst` (or your preferred name)
3. Description: "AI-powered angel investment analysis platform"
4. Privacy: **Private** (recommended for business apps)
5. **DO NOT** initialize with README (you already have files)
6. Click "Create repository"

### Push to GitHub
```bash
# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/angel-ai-analyst.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**✅ Checkpoint:** Your code is now on GitHub!

---

## ☁️ Step 3: Set Up Google Cloud Project

### Create & Configure Project
```bash
# Login to Google Cloud
gcloud auth login

# Create new project (or use existing)
gcloud projects create bocconi-ventures-ai --name="Bocconi Ventures AI"

# Set as active project
gcloud config set project bocconi-ventures-ai

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Enable billing (required for Cloud Run)
# Go to: https://console.cloud.google.com/billing
# Link billing account to project
```

### Set Region
```bash
# Set your preferred region (Europe recommended for Italy)
gcloud config set run/region europe-west1
```

---

## 🐳 Step 4: Build & Deploy to Cloud Run

### Set Up Secrets (Recommended for Sensitive Data)

```bash
# Create secrets in Google Secret Manager
echo -n "your-service-role-key" | gcloud secrets create supabase-service-key --data-file=-
echo -n "your-anthropic-api-key" | gcloud secrets create anthropic-key --data-file=-

# Get your project number
gcloud projects describe bocconi-ventures-ai --format="value(projectNumber)"

# Grant Cloud Run access to secrets (replace PROJECT_NUMBER)
gcloud secrets add-iam-policy-binding supabase-service-key \
  --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

gcloud secrets add-iam-policy-binding anthropic-key \
  --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### Deploy to Cloud Run

```bash
# Navigate to project directory
cd C:\Users\spiri\angel_gcc

# Build and deploy to Cloud Run
gcloud run deploy angel-ai-analyst \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL="your-supabase-url" \
  --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-key:latest \
  --set-secrets ANTHROPIC_API_KEY=anthropic-key:latest \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 300
```

**✅ Checkpoint:** Your app is now running on Cloud Run!
You'll receive a URL like: `https://angel-ai-analyst-xxxxx-ew.a.run.app`

---

## 🌐 Step 5: Configure Custom Domain (bocconiventures.vc/AI)

### Using Load Balancer for Path-Based Routing

```bash
# 1. Create serverless NEG (Network Endpoint Group)
gcloud compute network-endpoint-groups create angel-ai-neg \
  --region=europe-west1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=angel-ai-analyst

# 2. Create backend service
gcloud compute backend-services create angel-ai-backend \
  --global

# 3. Add NEG to backend
gcloud compute backend-services add-backend angel-ai-backend \
  --global \
  --network-endpoint-group=angel-ai-neg \
  --network-endpoint-group-region=europe-west1

# 4. Create URL map with path rules
gcloud compute url-maps create bocconi-ventures-map \
  --default-service angel-ai-backend

gcloud compute url-maps add-path-matcher bocconi-ventures-map \
  --path-matcher-name=ai-matcher \
  --default-service=angel-ai-backend \
  --path-rules="/AI/*=angel-ai-backend"

# 5. Create SSL certificate
gcloud compute ssl-certificates create bocconi-ventures-cert \
  --domains=bocconiventures.vc

# 6. Create HTTPS proxy
gcloud compute target-https-proxies create bocconi-ventures-proxy \
  --url-map=bocconi-ventures-map \
  --ssl-certificates=bocconi-ventures-cert

# 7. Create global forwarding rule
gcloud compute forwarding-rules create bocconi-ventures-https \
  --global \
  --target-https-proxy=bocconi-ventures-proxy \
  --ports=443

# 8. Get the Load Balancer IP
gcloud compute forwarding-rules describe bocconi-ventures-https \
  --global \
  --format="get(IPAddress)"
```

### DNS Configuration

1. **Update DNS Records at your DNS provider:**
   - **Type:** A
   - **Host:** @ (or bocconiventures.vc)
   - **Value:** [LOAD_BALANCER_IP from step 8]
   - **TTL:** 300

2. **Wait for DNS propagation** (5-60 minutes)

3. **Verify:**
```bash
# Test DNS
nslookup bocconiventures.vc

# Test HTTPS
curl -I https://bocconiventures.vc/AI
```

---

## 🔄 Step 6: Set Up Continuous Deployment (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

env:
  PROJECT_ID: bocconi-ventures-ai
  SERVICE_NAME: angel-ai-analyst
  REGION: europe-west1

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --source . \
            --platform managed \
            --region ${{ env.REGION }} \
            --project ${{ env.PROJECT_ID }} \
            --set-env-vars NEXT_PUBLIC_SUPABASE_URL="${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}" \
            --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY="${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
            --set-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-key:latest \
            --set-secrets ANTHROPIC_API_KEY=anthropic-key:latest
```

### Create Service Account for GitHub Actions

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Grant permissions
gcloud projects add-iam-policy-binding bocconi-ventures-ai \
  --member="serviceAccount:github-actions@bocconi-ventures-ai.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding bocconi-ventures-ai \
  --member="serviceAccount:github-actions@bocconi-ventures-ai.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding bocconi-ventures-ai \
  --member="serviceAccount:github-actions@bocconi-ventures-ai.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create key
gcloud iam service-accounts keys create github-key.json \
  --iam-account=github-actions@bocconi-ventures-ai.iam.gserviceaccount.com

# Copy the key content and add to GitHub Secrets as GCP_SA_KEY
```

### Add GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions:

- `GCP_SA_KEY`: Content of `github-key.json`
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key

---

## 📊 Step 7: Monitoring & Maintenance

### View Logs
```bash
# Stream real-time logs
gcloud run services logs tail angel-ai-analyst --region europe-west1

# View in Console: https://console.cloud.google.com/run
```

### Monitor Performance
```bash
# Get service details
gcloud run services describe angel-ai-analyst --region europe-west1

# View metrics: https://console.cloud.google.com/monitoring
```

### Cost Optimization
```bash
# Adjust resources based on usage
gcloud run services update angel-ai-analyst \
  --region europe-west1 \
  --min-instances 0 \
  --max-instances 5 \
  --memory 1Gi \
  --cpu 1
```

---

## 🚨 Troubleshooting

### Build Fails
```bash
# Check build logs
gcloud builds list --limit=5
gcloud builds log [BUILD_ID]
```

### 503 Service Unavailable
```bash
# Check logs for errors
gcloud run services logs tail angel-ai-analyst --region europe-west1

# Common fixes:
# - Increase memory: --memory 2Gi
# - Increase timeout: --timeout 300
# - Check environment variables
```

### Custom Domain Not Working
```bash
# Verify DNS propagation
nslookup bocconiventures.vc

# Check SSL certificate
gcloud compute ssl-certificates describe bocconi-ventures-cert

# Check load balancer
gcloud compute forwarding-rules list --global
```

### Environment Variables Not Set
```bash
# List current configuration
gcloud run services describe angel-ai-analyst \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"

# Update variables
gcloud run services update angel-ai-analyst \
  --region europe-west1 \
  --set-env-vars KEY=VALUE
```

---

## ✅ Deployment Checklist

- [ ] Docker files created (Dockerfile, .dockerignore)
- [ ] next.config.mjs updated with basePath
- [ ] .gitignore configured
- [ ] Environment variables prepared
- [ ] Code pushed to GitHub
- [ ] Google Cloud project created
- [ ] Billing enabled on GCP
- [ ] Secrets created in Secret Manager
- [ ] Cloud Run service deployed
- [ ] Load Balancer configured
- [ ] SSL certificate created
- [ ] DNS records updated
- [ ] Domain resolves correctly
- [ ] Application accessible at bocconiventures.vc/AI
- [ ] Monitoring enabled
- [ ] CI/CD pipeline set up (optional)

---

## 🎉 Success!

Your application should now be live at:
- **Production:** `https://bocconiventures.vc/AI`
- **Direct Cloud Run:** `https://angel-ai-analyst-xxxxx-ew.a.run.app`

### Next Steps
1. Test all functionality thoroughly
2. Set up monitoring alerts
3. Configure auto-scaling parameters
4. Implement caching strategies
5. Set up staging environment

---

## 📞 Need Help?

**Documentation:**
- Google Cloud Run: https://cloud.google.com/run/docs
- Next.js Deployment: https://nextjs.org/docs/deployment

**Quick Commands:**
```bash
# View logs
gcloud run services logs tail angel-ai-analyst --region europe-west1

# Update service
gcloud run services update angel-ai-analyst --region europe-west1

# Redeploy
gcloud run deploy angel-ai-analyst --source . --region europe-west1
```
