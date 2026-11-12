# BLEGO UX restoration formatting trigger

This commit requests a one-time Prettier pass only on the UX restoration branch. It does not publish the app, merge PR #1, or change the main development branch. Resulting code and GUI tests are checked by CI before preparing another Mac M1 QA build.
