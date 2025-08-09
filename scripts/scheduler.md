Cloud Scheduler (cada 6h)

Si tu endpoint público de tick es una Cloud Function/Cloud Run que expone POST /api/tick, crea un job así:

```bash
gcloud scheduler jobs create http avatar-tick \
  --schedule "0 */6 * * *" \
  --uri "https://<YOUR_REGION>-<YOUR_PROJECT>.cloudfunctions.net/tick" \
  --http-method=POST \
  --time-zone="America/Mexico_City"
```

Para Cloud Run con OIDC:

```bash
gcloud scheduler jobs create http avatar-tick \
  --schedule "0 */6 * * *" \
  --uri "https://<CLOUD_RUN_URL>/api/tick" \
  --http-method=POST \
  --oidc-service-account-email "<SERVICE_ACCOUNT>@<PROJECT>.iam.gserviceaccount.com" \
  --oidc-token-audience "https://<CLOUD_RUN_URL>" \
  --time-zone="America/Mexico_City"
```


