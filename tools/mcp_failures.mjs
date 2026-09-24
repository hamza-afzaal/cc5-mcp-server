/**
 * Failure shapes the tools report as text: refusals and bridge errors, failed
 * recipes, per-view render failures, failed jobs (from get_export_status) and
 * per-clip failures from export_motions. A design-budget "FAIL" is a finding,
 * not a failed step, so it doesn't stop the run.
 */
export function failed(text) {
  return /^(Recipe not applied|Refused|Failed|CC4 bridge error|No views rendered)|: FAILED$|^[a-z_]+: failed|^Job job_\d+ \([a-z_]+\): failed|^✗ /m.test(text);
}
