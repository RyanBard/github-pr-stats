# github-pr-stats
Just a little code to gather up some PR stats (prs/reviews/comments/etc.)

## Generating an API Key

* Go to https://github.com/settings/personal-access-tokens/new
* Create an api key that will have access to the repos you want to run this against

## Running

```sh
# preferably do this via a .env file or something to keep secrets out of your shell history
export GITHUB_API_KEY='<your-api-key>'

npm run start -- RyanBard/test-repo
```
