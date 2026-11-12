export async function makeDemo(country, type, requestId = crypto.randomUUID()) {
  if (!window.blego) throw Error('Open the desktop app to use persistent generation');
  return window.blego.generate({ country, type, requestId });
}
export function profileText(profile) {
  return profile.fieldOrder
    .map(
      (f) =>
        `${f}: ${Array.isArray(profile.fields[f]) ? profile.fields[f].join(', ') : profile.fields[f]}`
    )
    .join('\n');
}
