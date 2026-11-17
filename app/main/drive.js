let cfg = { clientId: '' };

const configured = () => !!cfg.clientId;

function configure(c) {
  cfg = {
    clientId: String((c && c.clientId) || '').trim()
  };
  return status();
}
