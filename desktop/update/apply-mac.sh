#!/bin/sh
# All paths arrive as positional arguments; never evaluate shell text from metadata.
target=$1
stage=$2
backup=$3
old_pid=$4
result=$5
healthy=$6
binary=$7
success_json=$8
failure_json=$9
user_data=${10}
log="${result%/*}/install.log"
exec >>"$log" 2>&1
write_result() { printf '%s' "$1" > "$result.tmp" && mv "$result.tmp" "$result"; }
i=0
while kill -0 "$old_pid" 2>/dev/null; do
  i=$((i+1)); [ "$i" -le 120 ] || { write_result "$failure_json"; exit 1; }
  sleep 1
done
[ -d "$target" ] && [ -d "$stage" ] && [ ! -e "$backup" ] || { write_result "$failure_json"; exit 1; }
if ! mv "$target" "$backup"; then write_result "$failure_json"; exit 1; fi
if ! mv "$stage" "$target"; then mv "$backup" "$target"; write_result "$failure_json"; "$target/$binary" --update-rollback "--user-data-dir=$user_data" & exit 1; fi
"$target/$binary" --updated "--user-data-dir=$user_data" &
new_pid=$!
i=0
while [ "$i" -lt 60 ]; do
  if [ -f "$healthy" ]; then
    rm -rf "$backup"
    rm -f "${result%/*}/"*.zip "${result%/*}/"*.dmg
    write_result "$success_json"
    exit 0
  fi
  kill -0 "$new_pid" 2>/dev/null || break
  i=$((i+1)); sleep 1
done
# Only stop the new process started by this helper before restoring the backup.
kill "$new_pid" 2>/dev/null || true
wait "$new_pid" 2>/dev/null || true
if mv "$target" "$stage" && mv "$backup" "$target"; then
  write_result "$failure_json"
  "$target/$binary" --update-rollback "--user-data-dir=$user_data" &
else
  write_result "$failure_json"
fi
exit 1
