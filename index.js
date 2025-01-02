const githubApiKey = process.env.GITHUB_API_KEY

const baseUrl = 'https://api.github.com'

const options = {
    headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${githubApiKey}`,
    },
}

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

// Maybe look into using this instead: https://docs.github.com/en/rest/activity/events

async function getPulls(ownerRepo, start, end) {
    try {
        const perPage = 100
        let resp
        let prPage = 1
        let lastCreatedAt
        let prHasMore = true
        do {
            // https://docs.github.com/en/rest/pulls/pulls
            resp = await fetch(`${baseUrl}/repos/${ownerRepo}/pulls?state=closed&page=${prPage}&per_page=${perPage}`, options)
            const data = await resp.json()
            if (resp.status > 299 || resp.status < 200) {
                throw new Error(`Unexpected status from GET pulls request: %s`, resp.status)
            }
            const p = data.map(async pr => {
                lastCreatedAt = new Date(pr.created_at)
                if (start.getTime() <= lastCreatedAt.getTime() && end.getTime() >= lastCreatedAt.getTime()) {
                    incPulls(pr.user.login)
                    let reviewPage = 1
                    let reviewHasMore = true
                    do {
                        const reviewResp = await fetch(`${pr.review_comments_url}?page=${reviewPage}&per_page=${perPage}`, options)
                        if (reviewResp.status > 299 || reviewResp.status < 200) {
                            throw new Error(`Unexpected status from GET review request: %s`, reviewResp.status)
                        }
                        const reviewData = await reviewResp.json()
                        reviewData.forEach(review => {
                            incReviews(review.user.login)
                        })
                        reviewPage += 1
                        reviewHasMore = reviewData.length === perPage
                    } while (reviewHasMore)
                    let commentsPage = 1
                    let commentsHasMore = true
                    do {
                        const commentsResp = await fetch(`${pr.comments_url}?page=${commentsPage}&per_page=${perPage}`, options)
                        if (commentsResp.status > 299 || commentsResp.status < 200) {
                            throw new Error(`Unexpected status from GET comments request: %s`, reviewResp.status)
                        }
                        const commentsData = await commentsResp.json()
                        commentsData.forEach(comment => {
                            incComments(comment.user.login)
                        })
                        commentsPage += 1
                        commentsHasMore = commentsData.length === perPage
                    } while (commentsHasMore)
                }
            })
            await Promise.all(p)
            prPage += 1
            prHasMore = data.length === perPage
        } while (prHasMore && start.getTime() <= lastCreatedAt.getTime())
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

console.log('Starting...\n')

getPulls(ownerRepo, start, end)
    .then(ignored => console.log('\nDone'), err => console.log('error: %O', err))
