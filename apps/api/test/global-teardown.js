/** Stops the embedded PostgreSQL started by global-setup.js (if any). */
module.exports = async function globalTeardown() {
  const pg = global.__e2ePostgres;
  if (pg) {
    try {
      await pg.stop();
    } catch {
      /* already stopped */
    }
  }
};
