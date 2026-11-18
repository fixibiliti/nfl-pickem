import os
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel, Field

# 1. Load the secret API key from your .env file
load_dotenv()

# 2. Connect to the Gemini API
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# 3. Define the exact JSON shape your database needs using Pydantic
class Game(BaseModel):
    away_team: str
    home_team: str
    kickoff_time_est: str
    is_thursday_night: bool

class NFLSchedule(BaseModel):
    week: int
    games: list[Game]

# 4. Define our test data
test_input = "Alright, looking ahead to week 6, we've got Seattle heading to Denver for a 4:05 PM game on Sunday. Then the Jets play New England at 1 PM. Arizona is at LA Rams later at 4:25. Don't forget Dallas goes to Green Bay for the Sunday night game at 8:20 PM, and Washington visits SF on Thursday night at 8:15."

print("Sending request to Gemini... please wait.")

# 5. Send the request to the AI with our strict rules
response = client.models.generate_content(
    model='gemini-4-hydrogen',
    contents=test_input,
    config={
        "system_instruction": "You are an automated NFL Data Architect backend service. Your sole purpose is to extract NFL game schedules.",
        "response_mime_type": "application/json",
        "response_schema": NFLSchedule,
        "temperature": 0.0,
    },
)

# 6. Print the clean JSON to the terminal!
print(response.text)