from stylecop_mover.report import report


def test_lists_everything_that_did_not_move():
    text = report(2, [("MyRule", "not a rule the old StyleCop shipped")], ["DocumentationRules / IncludeFields = False"],
                  ["GlobalSettings: <GlobalSettings>..."])
    assert "2 rule switch(es) moved" in text
    assert "Rule MyRule: not a rule the old StyleCop shipped" in text
    assert "IncludeFields = False" in text and "GlobalSettings" in text


def test_says_so_when_everything_moved():
    assert "Everything moved." in report(1, [], [], [])
