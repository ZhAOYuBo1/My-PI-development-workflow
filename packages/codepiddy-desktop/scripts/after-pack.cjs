const { rename, rm } = require("node:fs/promises");
const path = require("node:path");

module.exports = async function afterPack(context) {
  const runtimeDirectory = path.join(context.appOutDir, "resources", "runtime");
  const source = path.join(runtimeDirectory, "dependencies");
  const target = path.join(runtimeDirectory, "node_modules");
  await rm(target, { force: true, recursive: true });
  await rename(source, target);
};
