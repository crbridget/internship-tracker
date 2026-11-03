import pytest

from backend.titles import is_internship


@pytest.mark.parametrize('title', [
    'Software Engineering Intern',
    'Summer 2027 Internship - Data Science',
    'Machine Learning Co-op',
    'Coop, Hardware',
    'INTERN, Finance',
    'Intern (Fall)',
])
def test_internship_titles(title):
    assert is_internship(title)


@pytest.mark.parametrize('title', [
    # Substring matches the database ILIKE filter lets through; the word-
    # boundary regex is what rejects them.
    'Internal Audit Manager',
    'International Payroll Lead',
    'Internet Infrastructure Engineer',
    'Cooperative Robotics Engineer',
    'Senior Software Engineer',
    '',
])
def test_non_internship_titles(title):
    assert not is_internship(title)
