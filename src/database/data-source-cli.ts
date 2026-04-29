/**
 * TypeORM CLI entry-point. Registers tsconfig path aliases before the
 * DataSource is loaded so that @modules/* imports inside entity files resolve
 * correctly when running `typeorm-ts-node-commonjs`.
 */
import 'tsconfig-paths/register';
export { default } from './data-source';
