#!/usr/bin/env bash

set -e -u -o pipefail

while true ; do
    date
    gridlet -vvv -u "$(cat .enphase_username.txt)" -p "$(cat .enphase_password.txt)"
    sleep 5

    # Align execution to the beginning of the next hour
    #
    # We do this every time through the loop because the `gridlet` command takes
    # an unknown amount of time to run, and because the container itself may
    # have been started at an arbitrary point in time.
    now="$(date '+%s')"
    next_hour="$(date --date=$(date --date='next hour' '+%Y-%m-%dT%H:00:00') '+%s')"
    sleep_time="$((next_hour - now))"

    echo >&2 "Sleeping for $sleep_time seconds"
    sleep $sleep_time
done
