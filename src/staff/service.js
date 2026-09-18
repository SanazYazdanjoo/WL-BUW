export async function staffRequest(action, { csrf, body, signal } = {}) {
  const response = await fetch(`/api/staff/${action}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-CSRF-Token": csrf || "" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error("The staff service is unavailable. Please retry.");
  }
  if (!response.ok) {
    const error = new Error(
      value.error || "The staff action could not be completed.",
    );
    error.status = response.status;
    error.code = value.code;
    error.fields = value.fields;
    error.latest = value.latest;
    throw error;
  }
  return value;
}
