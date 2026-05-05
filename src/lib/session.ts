export function getSessionId(): string {
  let id = localStorage.getItem("mythos_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("mythos_session_id", id);
  }
  return id;
}
