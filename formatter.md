# Formatting style guideline

## Install husky

```bash
npx husky-init && npm install
```

> Above command will create a .husky folder and create a pre-commit hook file

## To add a pre-commit and pre-push hooks run these commands

```bash
npx husky set .husky/pre-commit "npm run pre-commit"
npx husky set .husky/pre-push "npm run pre-push"
```

> The above command will run the "npm pretty && npm lint" it will format all the files with prettier and run the linter to check the lint issue and if some issues are found then it will discard the commit.

<br/>

> If commit get fail follow these steps.

1. Fix the code formatting.

   ```bash
   npm run pretty
   ```

2. Fix the auto fixable es lint issues.

   ```bash
   npm run lint-fix
   ```

> then fix all linting errors manually which are not auto fixable.

### To setup this in other repos follow these steps

---

1. > Install these npm packages.

   ```bash
   npm i eslint eslint-config-airbnb-base eslint-plugin-import eslint-plugin-prettier eslint-config-prettier prettier lint-staged -D
   ```

2. > Copy .vscode, .eslintrc.js, .eslintignore .prettierignore, .prettierrc, formatter.md from user app

3. > Add below lines in the package.json inside script object

   ```json
   {
       ...
       "scripts": {
           ...
           "lint": "eslint .",
           "lint-fix": "eslint --fix .",
           "prepare": "husky install",
           "pretty": "prettier --write .",
           "pre-commit": "npm run pretty && npm run lint",
           "pre-push": "npm run lint"
       },
       "husky": {
           "hooks": {
           "pre-commit": "npm run pre-commit",
           "pre-push": "npm run pre-push"
           }
       },
       "lint-staged": {
           "*": [
           "npm run pretty",
           "lint-fix",
           "git add"
           ]
       },
       ...
   }
   ```

4. > Add pre-commit and pre-push hooks

   ```bash
   npx husky-init && npm install
   npx husky set .husky/pre-commit "npm run pre-commit"
   npx husky set .husky/pre-push "npm run pre-push"
   ```

5. > Remove .vscode from `.gitignore`
