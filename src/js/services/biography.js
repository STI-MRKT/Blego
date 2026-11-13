// One editor per profile. SQLite revisions are authoritative; snapshots are
// serialized without replacing a newer draft or blocking ordinary typing.
export function createBiographyEditor(data, {save, onSaved = () => {}, onChange = () => {}, delay = 400}) {
  let timer = null, flight = null, suggestionFlight = null, disposed = false, version = 0;
  const versions = {};
  const editor = {...data, values:{...data.values}, dirty:false, saving:false, error:false, suggesting:false, frozen:false};
  const notify = () => { if (!disposed) onChange(editor); };
  function cancelTimer() { clearTimeout(timer); timer = null; }
  function apply(patch, fromSuggestion = false) {
    if (disposed || (editor.frozen && !fromSuggestion)) return;
    for (const [key,value] of Object.entries(patch)) {
      if (editor.values[key] === value) continue;
      editor.values[key] = value;
      versions[key] = (versions[key] || 0) + 1;
      version++;
      editor.dirty = true;
    }
    if (!editor.dirty) return;
    editor.error = false;
    cancelTimer();
    timer = setTimeout(() => { editor.flush().catch(() => {}); }, delay);
    notify();
  }
  editor.update = patch => apply(patch);
  function saveDraft() {
    cancelTimer();
    if (flight) return flight;
    if (!editor.dirty || disposed) return Promise.resolve();
    flight = (async () => {
      while (editor.dirty && !disposed) {
        const sentVersion = version;
        const request = {action:'save',profileId:editor.profileId,revision:editor.revision,values:{...editor.values}};
        editor.saving = true; editor.error = false; notify();
        try {
          const profile = await save(request);
          editor.revision = profile.biographyRevision;
          editor.dirty = version !== sentVersion;
          onSaved(profile);
        } catch (error) {
          cancelTimer(); editor.error = true; throw error;
        } finally {
          editor.saving = false; notify();
        }
      }
      cancelTimer();
    })().finally(() => { flight = null; });
    return flight;
  }
  editor.flush = async () => {
    cancelTimer();
    // A regeneration requested before a transition belongs to this profile.
    if (suggestionFlight) await suggestionFlight;
    return saveDraft();
  };
  editor.suggest = (field, request) => {
    if (disposed || editor.suggesting || editor.frozen) return Promise.resolve(false);
    const keys = field === 'employer' ? ['employer','position'] : [field];
    const captured = keys.map(key => versions[key] || 0);
    if (field === 'position') { keys.push('employer'); captured.push(versions.employer || 0); }
    editor.suggesting = true; notify();
    suggestionFlight = (async () => {
      const patch = await request({action:'suggest',profileId:editor.profileId,field,values:{...editor.values}});
      if (disposed || keys.some((key,index) => (versions[key] || 0) !== captured[index])) return false;
      apply(patch, true);
      return true;
    })().finally(() => { suggestionFlight = null; editor.suggesting = false; notify(); });
    return suggestionFlight;
  };
  editor.freeze = () => { editor.frozen = true; notify(); };
  editor.release = () => { editor.frozen = false; notify(); };
  editor.dispose = () => { disposed = true; cancelTimer(); };
  return editor;
}
