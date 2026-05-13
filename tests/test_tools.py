from src.tools import check_sponsorship_signal, detect_ats_type


def test_check_sponsorship_signal_returns_likely_for_sponsorship_text():
    assert check_sponsorship_signal("We offer visa sponsorship for H1B and OPT candidates.") == "likely"


def test_check_sponsorship_signal_returns_unlikely_for_no_sponsorship_text():
    assert check_sponsorship_signal("This position cannot sponsor work visas.") == "unlikely"


def test_check_sponsorship_signal_returns_unknown_when_no_signal():
    assert check_sponsorship_signal("Join our engineering team.") == "unknown"


def test_detect_ats_type_identifies_lever():
    assert detect_ats_type("https://jobs.lever.co/openai") == "lever"


def test_detect_ats_type_returns_other_for_unknown_host():
    assert detect_ats_type("https://example.com/job") == "other"
