
  <TEST_SCENARIO_1>
    ## Objective: Authenticate User with Valid Credentials
    ## Test Group: Authentication
    ## Dependencies / Preconditions:
      - User account must exist with known credentials.
      - User must be logged out.
    ## Setup Steps (if needed beyond starting page):
      - None required beyond navigating to the initial page.
    ## Test Suite: authentication.auth.spec.ts
    ## User Workflow Steps:
      1. Navigate to the login page: http://localhost:3000/auth/login
      2. Enter valid email address "dmanix@wp.pl" into the email field.
      3. Enter valid password <HIDDEN> into the password field.
      4. Click the "Zaloguj się" (Sign In) button.
    ## Expected Outcomes / Assertions:
      - User is redirected to the main dashboard: http://localhost:3000/dashboard
      - The user's email "dmanix@wp.pl" appears in the header.
      - A "Wyloguj" (Logout) link is displayed in the header.
    ## Dynamic Data Considerations:
      - None.
    ## Potential Challenges:
      - Handling password as sensitive data.

  </TEST_SCENARIO_1>

  <TEST_SCENARIO_2>
    ## Objective: Generate Flashcards from Text
    ## Test Group: Flashcard Generation
    ## Dependencies / Preconditions:
      - User must be logged in.
    ## Setup Steps (if needed beyond starting page):
      - User must be logged in and on the dashboard page.
    ## Test Suite: flashcard-generation.auth.spec.ts
    ## User Workflow Steps:
      1. Navigate to the "Generuj Fiszki" (Generate Flashcards) page: http://localhost:3000/generate
      2. Paste the text (related to Adam Małysz) into the text area. Text length >= 1000 characters.
      3. Click the "Generuj fiszki" (Generate Flashcards) button.
      4. Wait for the flashcards to be generated.
      5. Accept the first generated flashcard.
      6. Reject the second generated flashcard.
      7. Edit the third generated flashcard, change the content, save it.
      8. Confirm changes.
    ## Expected Outcomes / Assertions:
      - The flashcard verification section is displayed after clicking the "Generuj fiszki" button.
      - The first flashcard has a status of "Zaakceptowano".
      - The second flashcard has a status of "Odrzucono".
      - The edited flashcard contains the updated text.
    ## Dynamic Data Considerations:
      - Generated flashcards and their contents are dynamic. The test must identify flashcards based on their initial text content.
    ## Potential Challenges:
      - Complex flashcard verification UI.
      - Handling the editing pop-up and saving the updated values.
      - Text comparison

  </TEST_SCENARIO_2>

  <TEST_SCENARIO_3>
    ## Objective: Delete a Flashcard
    ## Test Group: Flashcard Management
    ## Dependencies / Preconditions:
      - User must be logged in.
      - At least one flashcard must exist in the user's collection.
    ## Setup Steps (if needed beyond starting page):
      - User must be logged in and on the dashboard page.
    ## Test Suite: flashcard-management.auth.spec.ts
    ## User Workflow Steps:
      1. Navigate to the "Moja kolekcja" (My Collection) page: http://localhost:3000/flashcard?page=1&pagesize=20&sort=updatedAt&order=desc
      2. Click the "Usuń" (Delete) button for a specific flashcard (e.g., the first AI flashcard).
      3. Confirm the deletion by clicking the "Usuń" (Delete) button in the confirmation dialog.
    ## Expected Outcomes / Assertions:
      - The flashcard is removed from the collection.
    ## Dynamic Data Considerations:
      - The test should target a specific flashcard based on a stable identifier (e.g., its initial content).
    ## Potential Challenges:
      - Handling the deletion confirmation dialog (modal).

  </TEST_SCENARIO_3>

  <TEST_SCENARIO_4>
    ## Objective: Edit a Flashcard
    ## Test Group: Flashcard Management
    ## Dependencies / Preconditions:
      - User must be logged in.
      - At least one flashcard must exist in the user's collection.
    ## Setup Steps (if needed beyond starting page):
      - User must be logged in and on the dashboard page.
    ## Test Suite: flashcard-management.auth.spec.ts
    ## User Workflow Steps:
      1. Navigate to the "Moja kolekcja" (My Collection) page: http://localhost:3000/flashcard?page=1&pagesize=20&sort=updatedAt&order=desc
      2. Click the "Edytuj" (Edit) button for a specific flashcard.
      3. Modify the flashcard question and answer.
      4. Click the "Zapisz" (Save) button.
    ## Expected Outcomes / Assertions:
      - The flashcard is updated with the new question and answer.
    ## Dynamic Data Considerations:
      - The test should target a specific flashcard based on a stable identifier (e.g., its initial content).
    ## Potential Challenges:
      - Editing is done through a modal.
      - Handling updated timestamps.

  </TEST_SCENARIO_4>

    <TEST_SCENARIO_5>
    ## Objective: View Account Details
    ## Test Group: Account Management
    ## Dependencies / Preconditions:
      - User must be logged in.
    ## Setup Steps (if needed beyond starting page):
      - User must be logged in and on the dashboard page.
    ## Test Suite: account-management.auth.spec.ts
    ## User Workflow Steps:
      1. Navigate to the "Konto" (Account) page: http://localhost:3000/account
      2. Click the "Szczegóły" (Details) button for one of the generation logs.
      3. Close the generation details dialog by clicking the X button.
    ## Expected Outcomes / Assertions:
      - The account page is displayed with user profile information and generation details.
      - A modal with generation details is displayed.
      - The generation details dialog closes successfully.
    ## Dynamic Data Considerations:
      - Generation logs are dynamic and may vary depending on user activity.
    ## Potential Challenges:
      - Interacting with dynamic data within the account page.
      - Modal management

  </TEST_SCENARIO_5>

  <TEST_SCENARIO_6>
    ## Objective: Logout Successfully
    ## Test Group: Authentication
    ## Dependencies / Preconditions:
      - User must be logged in.
    ## Setup Steps (if needed beyond starting page):
      - User must be logged in and on the account page.
    ## Test Suite: authentication.auth.spec.ts
    ## User Workflow Steps:
      1. Click the "Wyloguj" (Logout) button.
    ## Expected Outcomes / Assertions:
      - User is redirected to the login page: http://localhost:3000/auth/login
    ## Dynamic Data Considerations:
      - None
    ## Potential Challenges:
      - None

  </TEST_SCENARIO_6>

  <TEST_PLAN_OVERVIEW>
    ## Suggested Page Objects:
      - LoginPage
      - DashboardPage
      - GenerateFlashcardsPage
      - FlashcardVerificationComponent (section)
      - MyCollectionPage
      - AccountPage
      - FlashcardComponent (individual flashcard representation)
      - ConfirmationDialog (used for deletion)

    ## Suggested Test Suites:
      - authentication.auth.spec.ts
      - flashcard-generation.auth.spec.ts
      - flashcard-management.auth.spec.ts
      - account-management.auth.spec.ts

    ## General Notes / Strategy:
      - Implement a login fixture/setup to handle user authentication before each test.
      - Use unique names for created test data.

  </TEST_PLAN_OVERVIEW>

  <SELECTOR_REQUIREMENTS>
    ## Essential Elements for Stable Selectors:
    To facilitate reliable test automation, please ensure stable and unique identifiers (e.g., data-testid attributes) are added for the following key UI elements observed during the workflows:
    - Login button ("Zaloguj się")
    - Email input field
    - Password input field
    - Main navigation links ("Dashboard", "Generuj", "Kolekcja", "Konto")
    - Generate flashcards button ("Generuj fiszki")
    - Accept flashcard button (green checkmark icon)
    - Reject flashcard button (red cross icon)
    - Edit flashcard button (pencil icon)
    - Save flashcard button ("Zapisz")
    - Delete flashcard button ("Usuń")
    - Confirm deletion button (in the confirmation dialog)
    - Logout button ("Wyloguj")
    - Error message display (invalid credentials)
  </SELECTOR_REQUIREMENTS>
