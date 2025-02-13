import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import { getParentDir, getSiblingFileName } from '../../../../util/fs';
import type { PackageFileContent } from '../../types';
import type { NpmManagerData } from '../types';
import { detectPnpmWorkspaces } from './pnpm';
import { matchesAnyPattern } from './utils';

export async function detectMonorepos(
  packageFiles: Partial<PackageFileContent<NpmManagerData>>[]
): Promise<void> {
  await detectPnpmWorkspaces(packageFiles);
  logger.debug('Detecting Lerna and Yarn Workspaces');
  for (const p of packageFiles) {
    const { packageFile, npmrc, managerData = {}, skipInstalls } = p;
    const {
      lernaClient,
      lernaJsonFile,
      lernaPackages,
      npmLock,
      yarnZeroInstall,
      hasPackageManager,
      workspacesPackages,
      yarnLock,
    } = managerData;

    const packages = (workspacesPackages ?? lernaPackages) as
      | string[]
      | undefined;
    if (packages?.length) {
      const internalPackagePatterns = (
        is.array(packages) ? packages : [packages]
      ).map((pattern) => getSiblingFileName(packageFile!, pattern));
      const internalPackageFiles = packageFiles.filter((sp) =>
        matchesAnyPattern(
          getParentDir(sp.packageFile!),
          internalPackagePatterns
        )
      );
      const internalPackageNames = internalPackageFiles
        .map((sp) => sp.managerData?.packageJsonName)
        .filter(Boolean);

      p.deps?.forEach((dep) => {
        if (internalPackageNames.includes(dep.depName)) {
          dep.isInternal = true;
        }
      });

      for (const subPackage of internalPackageFiles) {
        subPackage.managerData = subPackage.managerData ?? {};
        subPackage.managerData.lernaJsonFile = lernaJsonFile;
        subPackage.managerData.yarnZeroInstall = yarnZeroInstall;
        subPackage.managerData.hasPackageManager = hasPackageManager;
        subPackage.managerData.lernaClient = lernaClient;
        subPackage.managerData.yarnLock ??= yarnLock;
        subPackage.managerData.npmLock ??= npmLock;
        subPackage.skipInstalls = skipInstalls && subPackage.skipInstalls; // skip if both are true
        subPackage.managerData.hasWorkspaces = !!workspacesPackages;
        subPackage.npmrc ??= npmrc;

        if (p.extractedConstraints) {
          subPackage.extractedConstraints = {
            ...p.extractedConstraints,
            ...subPackage.extractedConstraints,
          };
        }

        subPackage.deps?.forEach((dep) => {
          if (internalPackageNames.includes(dep.depName)) {
            dep.isInternal = true;
          }
        });
      }
    }
  }
}
