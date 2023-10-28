/* global GA_ID, ga */

export default ({ router }) => {
    // Google analytics integration
    if (process.env.NODE_ENV === 'production' && GA_ID && typeof window !== 'undefined') {
    const s = document.createElement('script')
    s.async = 1
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    const s0 = document.getElementsByTagName('script')
    s0.parentNode.insertBefore(s, s0)

    gtag('js', new Date());
    gtag('config', GA_ID, {'send_page_view': false});

    router.afterEach(function (to) {
        gtag('event', 'page_view', {
            page_title: to.meta.title,
            page_location: router.app.$withBase(to.fullPath)
        });
    })
    }
}