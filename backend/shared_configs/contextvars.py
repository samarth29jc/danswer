import contextvars

from shared_configs.configs import POSTGRES_DEFAULT_SCHEMA

# Context variable for the current tenant id
CURRENT_TENANT_ID_CONTEXTVAR = contextvars.ContextVar(
    "current_tenant_id", default=POSTGRES_DEFAULT_SCHEMA
)

# Context variable for whether the current user is a cloud superuser
CLOUD_SUPERUSER_CONTEXTVAR = contextvars.ContextVar("cloud_superuser", default=False)
