import torch
import torch.nn as nn
from torchvision import models

class BrainTumorClassifier(nn.Module):
    """
    Official ResNet-50 Brain Tumor Classifier.
    Structure matches the neural-nexus-final.ipynb configuration.
    """
    def __init__(self, num_classes=4):
        super(BrainTumorClassifier, self).__init__()
        # Load backbone with random weights (to be replaced by our .pth)
        self.base_model = models.resnet50(weights=None)
        
        num_ftrs = self.base_model.fc.in_features # 2048
        
        # Exact head from training: Dropout(0.5) + Linear(2048, 4)
        self.base_model.fc = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(num_ftrs, num_classes)
        )
        
    def forward(self, x):
        return self.base_model(x)

def load_official_model(weights_path, device='cpu'):
    """
    Loads the trained weights into the classifier.
    Handles 'base_model.' prefix and strict loading.
    """
    model = BrainTumorClassifier(num_classes=4)
    state_dict = torch.load(weights_path, map_location=device)
    
    # Notebook weights are already prefixed with 'base_model.', 
    # and our class uses 'self.base_model', so this matches exactly.
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model
