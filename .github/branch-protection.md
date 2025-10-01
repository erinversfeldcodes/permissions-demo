# Branch Protection Configuration

To ensure the PR + deployment testing workflow works correctly, configure these branch protection rules for the `main` branch in GitHub:

## Required Settings:

1. **Go to**: GitHub Repository → Settings → Branches → Add rule for `main`

2. **Enable these protections**:
   - ✅ **Require pull request reviews before merging**
     - Dismiss stale PR approvals when new commits are pushed
     - Require review from code owners (optional)

   - ✅ **Require status checks to pass before merging**
     - Require branches to be up to date before merging
     - **Required status checks**:
       - `Unit Tests`
       - `Build Check`
       - `Test Preview Deployment`
       - `vercel` (Vercel's deployment check)

   - ✅ **Require conversation resolution before merging**

   - ✅ **Restrict pushes that create matching files**

   - ✅ **Do not allow bypassing the above settings**

## Required GitHub Secrets:

Add these in Repository → Settings → Secrets and variables → Actions:

- `VERCEL_PROTECTION_BYPASS`: The bypass token for testing protected Vercel deployments

## Workflow:

1. **Developer creates PR** → Preview deployment created automatically
2. **GitHub Actions runs**:
   - Unit tests
   - Build check
   - Waits for Vercel deployment
   - Runs automated tests against preview URL
   - Comments results on PR
3. **Review + Approval** → All checks must pass
4. **Merge to main** → Production deployment triggered automatically

This ensures every change is tested against a live deployment before reaching production.