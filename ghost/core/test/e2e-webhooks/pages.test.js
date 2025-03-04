const moment = require('moment-timezone');
const {
    agentProvider,
    mockManager,
    fixtureManager,
    matchers
} = require('../utils/e2e-framework');
const {
    anyGhostAgent,
    anyUuid,
    anyLocalURL,
    anyISODateTime,
    anyObjectId,
    anyContentVersion,
    anyNumber
} = matchers;

const tierSnapshot = {
    id: anyObjectId,
    created_at: anyISODateTime,
    updated_at: anyISODateTime
};

const tagSnapshot = tierSnapshot;
const roleSnapshot = tierSnapshot;

const buildAuthorSnapshot = (roles = false) => {
    const authorSnapshot = {
        last_seen: anyISODateTime,
        created_at: anyISODateTime,
        updated_at: anyISODateTime,
        url: anyLocalURL
    };

    if (roles) {
        return {...authorSnapshot, roles: Array(1).fill(roleSnapshot)};
    }

    return authorSnapshot;
};

const buildPageSnapshotWithTiers = ({
    published,
    tiersCount,
    tags = false,
    roles = false
}) => {
    return {
        id: anyObjectId,
        uuid: anyUuid,
        comment_id: anyObjectId,
        published_at: published ? anyISODateTime : null,
        created_at: anyISODateTime,
        updated_at: anyISODateTime,
        url: anyLocalURL,
        tiers: new Array(tiersCount).fill(tierSnapshot),
        primary_author: buildAuthorSnapshot(roles),
        authors: new Array(1).fill(buildAuthorSnapshot(roles)),
        primary_tag: tags ? tagSnapshot : null,
        tags: tags ? new Array(1).fill(tagSnapshot) : []
    };
};

const buildPreviousPageSnapshotWithTiers = (tiersCount) => {
    return {
        tiers: new Array(tiersCount).fill(tierSnapshot),
        updated_at: anyISODateTime
    };
};

const buildPreviousPageSnapshotWithTiersAndTags = ({tiersCount, tags}) => {
    const prevSnapshot = {
        tags: tags ? new Array(1).fill(tagSnapshot) : []
    };

    if (tiersCount > 0) {
        return {...prevSnapshot, tiers: new Array(tiersCount).fill(tierSnapshot)};
    }

    return prevSnapshot;
};

describe('page.* events', function () {
    let adminAPIAgent;
    let webhookMockReceiver;

    before(async function () {
        adminAPIAgent = await agentProvider.getAdminAPIAgent();
        await fixtureManager.init('integrations');
        await adminAPIAgent.loginAsOwner();
    });

    beforeEach(function () {
        webhookMockReceiver = mockManager.mockWebhookRequests();
    });

    afterEach(function () {
        mockManager.restore();
    });

    it('page.published event is triggered', async function () {
        const webhookURL = 'https://test-webhook-receiver.com/page-published/';
        await webhookMockReceiver.mock(webhookURL);
        await fixtureManager.insertWebhook({
            event: 'page.published',
            url: webhookURL
        });

        const res = await adminAPIAgent
            .post('pages/')
            .body({
                pages: [
                    {
                        title: 'testing page.published webhook',
                        status: 'draft'
                    }
                ]
            })
            .expectStatus(201);

        const id = res.body.pages[0].id;
        const publishedPage = res.body.pages[0];
        publishedPage.status = 'published';

        await adminAPIAgent
            .put('pages/' + id)
            .body({
                pages: [publishedPage]
            })
            .expectStatus(200);

        await webhookMockReceiver.receivedRequest();

        webhookMockReceiver
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                'content-length': anyNumber,
                'user-agent': anyGhostAgent
            })
            .matchBodySnapshot({
                page: {
                    current: buildPageSnapshotWithTiers({
                        published: true,
                        tiersCount: 2,
                        roles: true
                    }),
                    previous: buildPreviousPageSnapshotWithTiers(2)
                }
            });
    });

    it('page.added event is triggered', async function () {
        const webhookURL = 'https://test-webhook-receiver.com/page-added/';
        await webhookMockReceiver.mock(webhookURL);
        await fixtureManager.insertWebhook({
            event: 'page.added',
            url: webhookURL
        });

        await adminAPIAgent
            .post('pages/')
            .body({
                pages: [
                    {
                        title: 'testing page.added webhook',
                        status: 'draft',
                        displayName: 'webhookz'
                    }
                ]
            })
            .expectStatus(201);

        await webhookMockReceiver.receivedRequest();

        webhookMockReceiver
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                'content-length': anyNumber,
                'user-agent': anyGhostAgent
            })
            .matchBodySnapshot({
                page: {
                    current: buildPageSnapshotWithTiers({
                        published: false,
                        tiersCount: 2
                    })
                }
            });
    });

    it('page.edited event is triggered', async function () {
        const webhookURL = 'https://test-webhook-receiver.com/page-edited/';
        await webhookMockReceiver.mock(webhookURL);
        await fixtureManager.insertWebhook({
            event: 'page.edited',
            url: webhookURL
        });

        const res = await adminAPIAgent
            .post('pages/')
            .body({
                pages: [
                    {
                        title: 'testing page.edited webhook',
                        status: 'draft',
                        slug: 'testing-page-edited-webhook'
                    }
                ]
            })
            .expectStatus(201);

        const id = res.body.pages[0].id;
        const updatedPage = res.body.pages[0];
        updatedPage.title = 'updated test page';
        updatedPage.slug = 'updated-test-page';

        await adminAPIAgent
            .put('pages/' + id)
            .body({
                pages: [updatedPage]
            })
            .expectStatus(200);

        await webhookMockReceiver.receivedRequest();

        webhookMockReceiver
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                'content-length': anyNumber,
                'user-agent': anyGhostAgent
            })
            .matchBodySnapshot({
                page: {
                    current: buildPageSnapshotWithTiers({
                        published: false,
                        tiersCount: 2,
                        roles: true
                    }),
                    previous: buildPreviousPageSnapshotWithTiers(2)
                }
            });
    });

    it('page.scheduled event is triggered', async function () {
        const webhookURL = 'https://test-webhook-receiver.com/page-scheduled/';
        await webhookMockReceiver.mock(webhookURL);
        await fixtureManager.insertWebhook({
            event: 'page.scheduled',
            url: webhookURL
        });

        const res = await adminAPIAgent
            .post('pages/')
            .body({
                pages: [
                    {
                        title: 'testing page.scheduled webhook',
                        status: 'draft'
                    }
                ]
            })
            .expectStatus(201);

        const id = res.body.pages[0].id;
        const scheduledPage = res.body.pages[0];
        scheduledPage.status = 'scheduled';
        scheduledPage.published_at = moment().add(6, 'hours').toISOString();

        await adminAPIAgent
            .put('pages/' + id)
            .body({
                pages: [scheduledPage]
            })
            .expectStatus(200);

        await webhookMockReceiver.receivedRequest();

        webhookMockReceiver
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                'content-length': anyNumber,
                'user-agent': anyGhostAgent
            })
            .matchBodySnapshot({
                page: {
                    current: buildPageSnapshotWithTiers({
                        published: true,
                        tiersCount: 2,
                        roles: true
                    }),
                    previous: buildPreviousPageSnapshotWithTiers(2)
                }
            });
    });

    it('page.unpublished event is triggered', async function () {
        const webhookURL = 'https://test-webhook-receiver.com/page-unpublished/';
        await webhookMockReceiver.mock(webhookURL);
        await fixtureManager.insertWebhook({
            event: 'page.unpublished',
            url: webhookURL
        });

        const res = await adminAPIAgent
            .post('pages/')
            .body({
                pages: [
                    {
                        title: 'testing page.unpublished webhook',
                        status: 'published'
                    }
                ]
            })
            .expectStatus(201);

        const id = res.body.pages[0].id;
        const previouslyPublishedPage = res.body.pages[0];
        previouslyPublishedPage.status = 'draft';

        await adminAPIAgent
            .put('pages/' + id)
            .body({
                pages: [previouslyPublishedPage]
            })
            .expectStatus(200);

        await webhookMockReceiver.receivedRequest();

        webhookMockReceiver
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                'content-length': anyNumber,
                'user-agent': anyGhostAgent
            })
            .matchBodySnapshot({
                page: {
                    current: buildPageSnapshotWithTiers({
                        published: true,
                        tiersCount: 2,
                        roles: true
                    }),
                    previous: buildPreviousPageSnapshotWithTiers(2)
                }
            });
    });

    it('page.tag.detached event is triggered', async function () {
        const webhookURL = 'https://test-webhook-receiver.com/page-tag-detached/';
        await webhookMockReceiver.mock(webhookURL);
        await fixtureManager.insertWebhook({
            event: 'page.tag.detached',
            url: webhookURL
        });

        const res = await adminAPIAgent
            .post('pages/')
            .body({
                pages: [
                    {
                        title: 'test page.tag.detached webhook',
                        status: 'draft'
                    }
                ]
            })
            .expectStatus(201);
        const id = res.body.pages[0].id;
        const updatedPage = res.body.pages[0];
        updatedPage.tags = ['Testing TAGS'];
        await adminAPIAgent
            .put('pages/' + id)
            .body({
                pages: [updatedPage]
            })
            .expectStatus(200);

        updatedPage.tags = [];

        await adminAPIAgent
            .put('pages/' + id)
            .body({
                pages: [updatedPage]
            })
            .expectStatus(200);

        await webhookMockReceiver.receivedRequest();

        webhookMockReceiver
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                'content-length': anyNumber,
                'user-agent': anyGhostAgent
            })
            .matchBodySnapshot({
                page: {
                    current: buildPageSnapshotWithTiers({
                        published: false,
                        tiersCount: 2,
                        roles: true,
                        tags: false
                    }),
                    previous: buildPreviousPageSnapshotWithTiersAndTags({
                        tiersCount: 0,
                        tags: true
                    })
                }
            });
    });

    it('page.tag.attached event is triggered', async function () {
        const webhookURL = 'https://test-webhook-receiver.com/page-tag-attached/';
        await webhookMockReceiver.mock(webhookURL);
        await fixtureManager.insertWebhook({
            event: 'page.tag.attached',
            url: webhookURL
        });

        const res = await adminAPIAgent
            .post('pages/')
            .body({
                pages: [
                    {
                        title: 'testing page.tag.attached webhook',
                        status: 'draft'
                    }
                ]
            })
            .expectStatus(201);

        const id = res.body.pages[0].id;
        const pageTagAttached = res.body.pages[0];
        pageTagAttached.status = 'draft';
        pageTagAttached.tags = ['Blogs'];

        await adminAPIAgent
            .put('pages/' + id)
            .body({
                pages: [pageTagAttached]
            })
            .expectStatus(200);

        await webhookMockReceiver.receivedRequest();

        webhookMockReceiver
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                'content-length': anyNumber,
                'user-agent': anyGhostAgent
            })
            .matchBodySnapshot({
                page: {
                    current: buildPageSnapshotWithTiers({
                        published: false,
                        tiersCount: 2,
                        tags: true,
                        roles: true
                    }),
                    previous: buildPreviousPageSnapshotWithTiersAndTags({
                        tiersCount: 2,
                        tags: false
                    })
                }
            });
    });
});
