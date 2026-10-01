FROM clamav/clamav:stable

# Render detects this TCP port for the private-service health check. ClamAV's
# upstream entrypoint downloads signatures before starting clamd.
EXPOSE 3310
