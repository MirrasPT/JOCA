# /review-code — Code Review

Determine the review target:
- File(s) specified by the user
- IDE selection if there is one
- Current directory if nothing is specified — confirm before proceeding

Invoke the `tester-code` agent with the determined target.

After the review, ask:
> "Do you want an additional adversarial review with Codex (OpenAI)? Note: code leaves the machine for the OpenAI API."

- If yes: invoke the `codex-review` agent and highlight where it diverges from tester-code
- If no: present only the tester-code report
