import os
from huggingface_hub import InferenceClient
from huggingface_hub.errors import HfHubHTTPError
from dotenv import load_dotenv

load_dotenv()

# We use BioMistral-7B as the primary model.
# If it's unavailable on free endpoints, we fallback to mistralai/Mistral-7B-Instruct-v0.2
PRIMARY_MODEL = "BioMistral/BioMistral-7B"
FALLBACK_MODEL = "mistralai/Mistral-7B-Instruct-v0.2"

hf_token = os.getenv("HF_TOKEN")
# We initialize client. If hf_token is None, it uses the free public tier.
# It is better to have a token to increase rate limits.
client = InferenceClient(model=PRIMARY_MODEL, token=hf_token)
fallback_client = InferenceClient(model=FALLBACK_MODEL, token=hf_token)

def _generate_text(prompt: str, max_new_tokens: int = 512, temperature: float = 0.3) -> str:
    """Helper to generate text with fallback logic."""
    # We use chat_completion which is generally more stable and handles the inference routing better
    messages = [{"role": "user", "content": prompt}]
    
    try:
        response = client.chat_completion(
            messages,
            max_tokens=max_new_tokens,
            temperature=temperature
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"BioMistral inference failed ({e}). Falling back to {FALLBACK_MODEL}...")
        try:
            response = fallback_client.chat_completion(
                messages,
                max_tokens=max_new_tokens,
                temperature=temperature
            )
            return response.choices[0].message.content.strip()
        except Exception as fallback_e:
            print(f"Fallback inference failed: {fallback_e}")
            return "Error: Unable to generate response due to API limits or model unavailability."


def generate_clinical_narrative(analysis_data: dict, risk_metrics: dict, patient_meta: dict = None) -> str:
    """
    Takes ResNet-50 output + risk metrics and generates 
    an AI explanation of the prediction and clinical risk.
    """
    # Format the probability distribution
    probs = ""
    for cls, prob in analysis_data['probabilities'].items():
        if prob > 0.01:
            probs += f"  - {cls}: {prob:.1%}\n"

    patient_context = f"PATIENT CONTEXT:\n{patient_meta}\n" if patient_meta else ""

    prompt = f"""<s>[INST] You are an expert AI clinical risk predictor analyzing an MRI scan. Explain the prediction and the patient's associated risk based on the provided mathematical metrics. Keep it highly professional and concise. Do not use markdown formatting.

MODEL PREDICTION:
- Primary AI Diagnosis: {analysis_data['label']}
- System Confidence: {analysis_data['confidence']:.1%}
{probs}

EXTRACTED RISK METRICS:
- Tumor Irregularity/Entropy (0-1): {risk_metrics['irregularity_ratio']} (Higher implies scattered, malignant boundaries)
- Relative Activation Area: {risk_metrics['activation_area']:.1%} of brain volume
- Composite Clinical Risk Score: {risk_metrics['risk_score']}/100

{patient_context}
Generate exactly 3 sections:
1. Prediction Explanation: Briefly explain why the model made this prediction based on the confidence and probabilities.
2. Risk Assessment: Analyze the provided Risk Metrics (Entropy, Area, Score) and explain what they indicate about the tumor's severity.
3. Clinical Recommendation: Provide a brief recommendation based on the risk score.

Frame it as AI-assisted findings requiring professional clinical correlation. [/INST]
"""

    narrative = _generate_text(prompt, max_new_tokens=400, temperature=0.3)
    
    # If the response failed heavily:
    if "Error:" in narrative and "API limits" in narrative:
        return f"Prediction Explanation: The model predicted {analysis_data['label']} with {analysis_data['confidence']:.1%} confidence. The calculated Clinical Risk Score is {risk_metrics['risk_score']}/100 based on an irregularity ratio of {risk_metrics['irregularity_ratio']}."
        
    return narrative


