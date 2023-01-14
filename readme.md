We've left in the top level package.json even though it's not actively being
used. The idea is to set up prettier and eslint at the top level to cover all
the individual actions.

It appears that .github/actions can be removed (we haven't had a chance to
test it yet).

Regarding having the node_modules checked in for individual actions,
please see HIP-949
