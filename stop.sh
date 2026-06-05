#!/bin/bash
echo "Stopping AltSearch and all associated services..."
docker compose --profile npm --profile proxy down --remove-orphans
echo "All services stopped."
