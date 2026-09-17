export function cleanPath(value = "") {
  // Explicitly reject control bytes rather than normalizing potentially hostile paths.
  if (
    typeof value !== "string" ||
    value.includes("\\") ||
    value.includes("%") ||
    [...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) ||
    value.split("/").some((part) => part === ".." || part === ".")
  ) {
    throw new Error("Invalid file path.");
  }
  return value.split("/").filter(Boolean).join("/");
}

export function isPublicDocument(path) {
  try {
    return (
      cleanPath(path) === path &&
      path.startsWith("documents/") &&
      path.split("/").every((part) => part && !part.startsWith("."))
    );
  } catch {
    return false;
  }
}
