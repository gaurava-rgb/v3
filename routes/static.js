/**
 * Static page routes: /terms, /faq
 */

var express = require('express');
var router = express.Router();
var { readClient } = require('../lib/supabase');
var { escHtml } = require('../lib/helpers');
var { renderStaticPage } = require('../lib/views');

router.get('/terms', function(req, res) {
    var body = [
        '<h1>Terms of Use</h1>',
        '<p class="updated">Last updated: March 1, 2026</p>',
        '<h2>1. What RideSplit Is (and Isn\'t)</h2>',
        '<p>RideSplit is a free, informational bulletin board that aggregates publicly posted ride-share messages from WhatsApp groups. We do not arrange, broker, or provide transportation services. We are not a ride-sharing company, a taxi service, or a transportation network company.</p>',
        '<h2>2. No Guarantees</h2>',
        '<p>All ride information is posted by third parties in WhatsApp groups. We make no guarantees about the accuracy, safety, reliability, or availability of any ride listed. Information may be outdated, incorrect, or no longer available.</p>',
        '<h2>3. Your Responsibility</h2>',
        '<p>By using this site, you acknowledge that:</p>',
        '<ul>',
        '<li>You are solely responsible for any arrangements you make with other users.</li>',
        '<li>You assume all risk when sharing rides with others.</li>',
        '<li>You should exercise your own judgment about the safety of any ride arrangement.</li>',
        '<li>RideSplit is not a party to any agreement between riders and drivers.</li>',
        '</ul>',
        '<h2>4. We Are Not Liable</h2>',
        '<p>To the maximum extent permitted by law, RideSplit and its creator(s) shall not be liable for any damages, injuries, losses, or disputes arising from ride arrangements made using information found on this site. This includes but is not limited to: accidents, property damage, personal injury, theft, fraud, or any other harm.</p>',
        '<h2>5. No Vetting</h2>',
        '<p>We do not verify the identity, driving record, insurance status, vehicle condition, or background of any person listed on this site. @tamu.edu email verification confirms university affiliation only, not trustworthiness.</p>',
        '<h2>6. Data &amp; Privacy</h2>',
        '<ul>',
        '<li>We display messages that were already posted publicly in WhatsApp groups.</li>',
        '<li>Full names and contact details are only visible to authenticated @tamu.edu users.</li>',
        '<li>We do not sell or share your data with third parties.</li>',
        '<li>We store login sessions via cookies. No passwords are stored.</li>',
        '</ul>',
        '<h2>7. Acceptable Use</h2>',
        '<p>Do not use this site to: harass other users, post false information, scrape data for commercial purposes, or any unlawful activity.</p>',
        '<h2>8. Changes</h2>',
        '<p>We may update these terms at any time. Continued use of the site constitutes acceptance.</p>',
        '<h2>9. Contact</h2>',
        '<p><a href="mailto:gaurav_a@tamu.edu?subject=ridesplit">gaurav_a@tamu.edu</a> (subject: ridesplit)</p>'
    ].join('\n');
    res.send(renderStaticPage('Terms', body));
});

router.get('/faq', async function(req, res) {
    var groupNames = [];
    try {
        var gRes = await readClient.from('monitored_groups').select('group_name')
            .eq('active', true).neq('group_name', 'Dump');
        if (gRes.data) {
            var seen = {};
            gRes.data.forEach(function(g) {
                var n = g.group_name.trim();
                if (!seen[n]) { seen[n] = true; groupNames.push(n); }
            });
            groupNames.sort();
        }
    } catch (e) { /* fallback: empty list */ }

    var groupListHtml = groupNames.length
        ? '<ul>' + groupNames.map(function(n) { return '<li>' + escHtml(n) + '</li>'; }).join('') + '</ul>'
        : '<p class="faq-a"><em>Unable to load group list.</em></p>';

    var body = [
        '<h1>FAQs</h1>',
        '<p class="updated">ridesplit.app</p>',
        '<div class="faq-q">1. What is this website?</div>',
        '<p class="faq-a">Hi, I made this to track groups on WhatsApp that I am in. I see a lot of messages across all these groups for tracking ride requests. It\'s hard to track who is going when, etc. I hope this helps, especially next week (spring break).</p>',
        '<div class="faq-q">2. How to use this?</div>',
        '<p class="faq-a">For now, find someone with whom you can split a ride on a date you like. If you login with your <strong>@tamu.edu</strong> email, you can see their details to contact them.</p>',
        '<div class="faq-q">3. Who is it for?</div>',
        '<p class="faq-a">Aggies only \u2014 You can only log in by verifying your <strong>@tamu.edu</strong> email. It was the simplest way I could add authentication and determine who actually sees our data.</p>',
        '<div class="faq-q">4. Which groups are being tracked?</div>',
        '<p class="faq-a">Currently tracking ' + groupNames.length + ' WhatsApp groups:</p>',
        groupListHtml,
        '<div class="faq-q">5. Can you track our group?</div>',
        '<p class="faq-a">Add +1-979-344-5977 (that\'s me \u2014 Gaurav), then I\'ll track rides in your group too.</p>',
        '<div class="faq-q">6. This has bugs / I have questions / I have complaints. Who do I contact?</div>',
        '<p class="faq-a"><a href="mailto:gaurav_a@tamu.edu?subject=ridesplit">gaurav_a@tamu.edu</a> (subject: ridesplit would be nice). Will add a contact form later.</p>',
        '<div class="faq-q">7. Who made this?</div>',
        '<p class="faq-a">Hi, it\'s me, <strong>Gaurav Arora</strong>. MS MIS \'26.</p>',
        '<div class="faq-q">8. Is this made by AI?</div>',
        '<p class="faq-a"><img src="/public/faq-ai.webp" alt="Is this made by AI?" style="max-width: 300px; border-radius: 8px; margin-top: 8px;"></p>'
    ].join('\n');
    res.send(renderStaticPage('FAQ', body));
});

module.exports = router;
