const githubApiKey = process.env.GITHUB_API_KEY

const axios = require('axios')

const instance = axios.create({
    baseURL: 'https://api.github.com',
    timeout: 11000,
    headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${githubApiKey}`,
    },
})

const pulls = {}
const reviews = {}
const comments = {}

function incPulls(login) {
    pulls[login] = (pulls[login] || 0) + 1
}

function incReviews(login) {
    reviews[login] = (reviews[login] || 0) + 1
}

function incComments(login) {
    comments[login] = (comments[login] || 0) + 1
}

async function getPulls(ownerRepo, start, end) {
    try {
        let resp
        let prPage = 1
        let lastCreatedAt
        do {
            // https://www.npmjs.com/package/axios
            // https://docs.github.com/en/rest/pulls/pulls
            resp = await instance.get(`/repos/healthbam/healthbam/pulls?state=closed&page=${prPage}`)
            const p = resp.data.map(async pr => {
                lastCreatedAt = new Date(pr.created_at)
                if (start.getTime() <= lastCreatedAt.getTime() && end.getTime() >= lastCreatedAt.getTime()) {
                    incPulls(pr.user.login)
                    let reviewPage = 1
                    let reviewResp
                    do {
                        reviewResp = await instance.get(`${pr.review_comments_url}?page=${reviewPage}`)
                        reviewResp.data.forEach(review => {
                            incReviews(review.user.login)
                        })
                        reviewPage += 1
                    } while (reviewResp.data.length)
                    let commentsPage = 1
                    let commentsResp
                    do {
                        commentsResp = await instance.get(`${pr.comments_url}?page=${commentsPage}`)
                        commentsResp.data.forEach(comment => {
                            incComments(comment.user.login)
                        })
                        commentsPage += 1
                    } while (commentsResp.data.length)
                }
            })
            await Promise.all(p)
            prPage += 1
        } while (resp.data.length && start.getTime() <= lastCreatedAt.getTime())
    } catch (err) {
        console.log('err: ', err)
    }

    console.log('pulls: ', pulls)
    console.log('reviews: ', reviews)
    console.log('comments: ', comments)
}

function validateOwnerRepo(input) {
    // TODO - this regex might be a little too strict
    if (!input || !/\w+\/\w+/.test(input)) {
        throw new Error(`Invalid 'owner-repo': ${input}`)
    }
    return input
}

function validateOptionalDate(key, input, defaultValue) {
    if (!input) {
        return defaultValue
    }
    const d = new Date(input)
    if (isNaN(d.getTime())) {
        throw new Error(`Invalid date string for '${key}': ${input}`)
    }
    return d
}

let ownerRepo
let start
let end

try {
    ownerRepo = validateOwnerRepo(process.argv[2])
    start = validateOptionalDate('start', process.argv[3], new Date(1))
    end = validateOptionalDate('end', process.argv[4], new Date())
} catch (err) {
    console.log(err)
    process.exit(1)
}

getPulls(ownerRepo, start, end)
