# Setup Google Cloud Secrets

The application requires secrets to be stored in Google Secret Manager for secure build-time access.

## 1. Create Secrets in Secret Manager

Run these commands with YOUR actual values:

```bash
# Set your project ID
PROJECT_ID="your-project-id"

# Create Supabase URL secret
echo -n "https://pkwbzhucmffsoljugmgs.supabase.co" | \
  gcloud secrets create supabase-url \
  --project=$PROJECT_ID \
  --replication-policy="automatic" \
  --data-file=-

# Create Supabase Anon Key secret
echo -n "YOUR_SUPABASE_ANON_KEY" | \
  gcloud secrets create supabase-anon-key \
  --project=$PROJECT_ID \
  --replication-policy="automatic" \
  --data-file=-

# Create Anthropic API Key secret
echo -n "YOUR_ANTHROPIC_API_KEY" | \
  gcloud secrets create anthropic-api-key \
  --project=$PROJECT_ID \
  --replication-policy="automatic" \
  --data-file=-
```

## 2. Grant Cloud Build Access to Secrets

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant Cloud Build service account access to secrets
gcloud secrets add-iam-policy-binding supabase-url \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding supabase-anon-key \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding anthropic-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 3. Verify Secrets

```bash
# List all secrets
gcloud secrets list

# View secret metadata (not the actual value)
gcloud secrets describe supabase-url
gcloud secrets describe supabase-anon-key
gcloud secrets describe anthropic-api-key
```

## 4. Trigger New Build

After secrets are created, push to GitHub to trigger a new build:

```bash
git push
```

The build will now have access to your Supabase credentials at build time, allowing Next.js to properly inline the `NEXT_PUBLIC_*` variables into the JavaScript bundle.

## Alternative: Quick Setup via Console

1. Go to: https://console.cloud.google.com/security/secret-manager
2. Click **"CREATE SECRET"** for each:
   - Name: `supabase-url`, Value: `https://pkwbzhucmffsoljugmgs.supabase.co`
   - Name: `supabase-anon-key`, Value: Your anon key
   - Name: `anthropic-api-key`, Value: Your Anthropic key
3. For each secret, go to **Permissions** tab:
   - Click **"GRANT ACCESS"**
   - Principal: `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`
   - Role: **Secret Manager Secret Accessor**
   - Click **SAVE**

## Troubleshooting

If build fails with "permission denied" on secrets:
- Verify the Cloud Build service account has the `roles/secretmanager.secretAccessor` role
- Check the secret names match exactly (case-sensitive)
- Ensure secrets exist: `gcloud secrets list`
