// Copies each mixin class's methods onto the target class's prototype.
// Throws on a name clash so two files can't silently define the same method.
export function applyMixins(target, mixins) {
  for (const mixin of mixins) {
    for (const name of Object.getOwnPropertyNames(mixin.prototype)) {
      if (name === 'constructor') continue;
      if (Object.prototype.hasOwnProperty.call(target.prototype, name)) {
        throw new Error(`applyMixins: ${target.name}.${name} is defined twice (clash from ${mixin.name})`);
      }
      Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(mixin.prototype, name));
    }
  }
}
