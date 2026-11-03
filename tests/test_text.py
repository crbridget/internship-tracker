import html

from backend import text


class TestHtmlToText:
    def test_empty_input(self):
        assert text.html_to_text('') == ''
        assert text.html_to_text(None) == ''

    def test_blocks_become_lines_and_list_items_become_bullets(self):
        out = text.html_to_text('<p>About the role</p><ul><li>Python</li><li>SQL</li></ul>')
        assert out == 'About the role\n- Python\n- SQL'

    def test_whitespace_and_nbsp_collapse(self):
        assert text.html_to_text('<p>  lots \t of&nbsp;&nbsp;space  </p>') == 'lots of space'

    def test_entities_are_decoded(self):
        assert text.html_to_text('<p>R&amp;D &lt;team&gt;</p>') == 'R&D <team>'

    def test_empty_list_items_leave_no_bare_bullets(self):
        assert text.html_to_text('<ul><li>One</li><li></li><li> </li></ul>') == '- One'

    def test_br_breaks_lines_in_both_forms(self):
        assert text.html_to_text('a<br>b<br/>c') == 'a\nb\nc'

    def test_boilerplate_sections_are_removed(self):
        fragment = (
            '<div class="content-intro"><p>We are a great company.</p></div>'
            '<p>Build data pipelines.</p>'
            '<div class="content-pay-transparency"><div class="pay-range">$100k</div></div>'
            '<div class="content-conclusion"><p>Equal opportunity employer.</p></div>'
        )
        assert text.html_to_text(fragment) == 'Build data pipelines.'

    def test_nested_divs_inside_boilerplate_dont_end_the_skip_early(self):
        fragment = (
            '<div class="content-intro"><div><div>inner</div></div><p>still intro</p></div>'
            '<p>The job</p>'
        )
        assert text.html_to_text(fragment) == 'The job'

    def test_void_tags_inside_boilerplate_dont_unbalance_depth(self):
        fragment = '<div class="content-intro">a<br>b<img src="x"><hr></div><p>The job</p>'
        assert text.html_to_text(fragment) == 'The job'

    def test_boilerplate_class_matches_among_several_classes(self):
        fragment = '<div class="foo content-conclusion bar"><p>EEO</p></div><p>Job</p>'
        assert text.html_to_text(fragment) == 'Job'

    def test_falls_back_to_full_text_when_everything_is_boilerplate(self):
        # Some Klaviyo postings put the whole description inside content-intro.
        fragment = '<div class="content-intro"><p>The entire posting</p></div>'
        assert text.html_to_text(fragment) == 'The entire posting'

    def test_strip_boilerplate_false_keeps_everything(self):
        fragment = '<div class="content-intro"><p>Intro</p></div><p>Job</p>'
        assert text.html_to_text(fragment, strip_boilerplate=False) == 'Intro\nJob'


class TestGreenhouseDescription:
    def test_unescapes_entity_encoded_html_before_stripping(self):
        raw = '<div class="content-intro"><p>Blurb</p></div><p>Ship features &amp; fix bugs</p>'
        posting = {'content': html.escape(raw)}
        assert text.greenhouse_description(posting) == 'Ship features & fix bugs'

    def test_missing_or_null_content(self):
        assert text.greenhouse_description({}) == ''
        assert text.greenhouse_description({'content': None}) == ''


class TestLeverDescription:
    def test_joins_description_and_headed_lists(self):
        posting = {
            'descriptionPlain': 'We build robots.',
            'lists': [
                {'text': 'Responsibilities ', 'content': '<li>Write code</li><li>Test it</li>'},
                {'text': 'Requirements', 'content': '<li>Python</li>'},
            ],
        }
        assert text.lever_description(posting) == (
            'We build robots.\n\n'
            'Responsibilities\n- Write code\n- Test it\n\n'
            'Requirements\n- Python'
        )

    def test_lists_only_when_description_plain_is_empty(self):
        # 45 tracked postings look like this; all their content is in lists.
        posting = {'descriptionPlain': '', 'lists': [{'text': 'What you do', 'content': '<li>Things</li>'}]}
        assert text.lever_description(posting) == 'What you do\n- Things'

    def test_unescapes_entities_left_in_plain_text(self):
        # Paytm's "plain" text contains literal &amp;.
        assert text.lever_description({'descriptionPlain': 'consumers &amp; merchants'}) == 'consumers & merchants'

    def test_skips_additional_plain_boilerplate(self):
        posting = {'descriptionPlain': 'The job.', 'additionalPlain': 'Equal opportunity employer.'}
        assert text.lever_description(posting) == 'The job.'

    def test_does_not_duplicate_opening_and_body(self):
        posting = {
            'descriptionPlain': 'Opening. Body.',
            'openingPlain': 'Opening.',
            'descriptionBodyPlain': 'Body.',
        }
        assert text.lever_description(posting) == 'Opening. Body.'

    def test_empty_posting(self):
        assert text.lever_description({}) == ''


class TestDescriptionHash:
    def test_empty_text_has_no_hash(self):
        assert text.description_hash('') is None
        assert text.description_hash(None) is None

    def test_stable_and_content_sensitive(self):
        assert text.description_hash('abc') == text.description_hash('abc')
        assert text.description_hash('abc') != text.description_hash('abd')
        assert len(text.description_hash('abc')) == 64
