"""
VISTA Pipeline - Tahap 2B: Local Semantic Segmentation (Testing)

Script ini mengeksekusi AI Computer Vision (SegFormer) SECARA LOKAL di komputer Anda 
tanpa perlu membuka Google Colab. Sangat cocok untuk menguji 5-50 gambar pertama 
sebelum melakukan pemrosesan massal ribuan gambar di cloud.

Sesuai Proposal:
Mengekstrak indikator visual: Sky View Factor, Green View Index, Road Width, dll.
"""

import os
import torch
import warnings
from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation
from PIL import Image
import numpy as np
import pandas as pd
import time

# Matikan warning agar terminal bersih
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

def run_local_segmentation():
    IMAGE_DIR = 'data/images'
    OUTPUT_DIR = 'data'
    
    if not os.path.exists(IMAGE_DIR):
        print(f"Folder {IMAGE_DIR} tidak ditemukan!")
        return
        
    images = [f for f in os.listdir(IMAGE_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    real_images = [f for f in images if os.path.getsize(os.path.join(IMAGE_DIR, f)) > 5000]
    
    if len(real_images) == 0:
        print("Tidak ada gambar asli (ukuran >5KB) yang ditemukan. Pastikan scraper sudah dijalankan dengan API Key.")
        return
        
    print("=== TAHAP 2B: AI Semantic Segmentation (Lokal) ===\n")
    print(f"Ditemukan {len(real_images)} gambar asli untuk dianalisis.")
    
    MODEL_NAME = 'nvidia/segformer-b2-finetuned-cityscapes-1024-1024'
    print(f"Mengunduh/Memuat model AI ({MODEL_NAME})... (Bisa memakan waktu 1-2 menit untuk pertama kali)")
    
    processor = SegformerImageProcessor.from_pretrained(MODEL_NAME)
    model = SegformerForSemanticSegmentation.from_pretrained(MODEL_NAME)
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model.to(device)
    model.eval()
    print(f"AI Model siap di: {device.upper()}\n")
    
    VISTA_CLASSES = {
        'road_width_index': 0,
        'sidewalk_ratio': 1,
        'street_canyon_enclosure': 2,
        'green_view_index': 8,
        'sky_view_factor': 10,
    }
    
    results = []
    
    start_time = time.time()
    for idx, img_file in enumerate(real_images):
        print(f"Memproses [{idx+1}/{len(real_images)}]: {img_file}")
        img_path = os.path.join(IMAGE_DIR, img_file)
        
        try:
            image = Image.open(img_path).convert('RGB')
        except:
            print(f"  Gagal membaca gambar {img_file}")
            continue
            
        inputs = processor(images=image, return_tensors='pt').to(device)
        
        with torch.no_grad():
            outputs = model(**inputs)
            
        logits = torch.nn.functional.interpolate(
            outputs.logits,
            size=image.size[::-1],
            mode='bilinear',
            align_corners=False,
        )
        
        seg_map = logits.argmax(dim=1)[0].cpu().numpy()
        total_pixels = seg_map.size
        
        metrics = {'filename': img_file}
        for metric_name, class_id in VISTA_CLASSES.items():
            ratio = np.sum(seg_map == class_id) / total_pixels
            metrics[metric_name] = round(ratio, 4)
            
        # Hitung skor gabungan sesuai bobot proposal
        metrics['visual_perception_score'] = round(
            metrics['green_view_index'] * 0.30 +
            metrics['sky_view_factor'] * 0.25 +
            metrics['sidewalk_ratio'] * 0.20 +
            (1 - metrics['street_canyon_enclosure']) * 0.15 +
            metrics['road_width_index'] * 0.10, 4
        )
        
        print(f"  -> GVI: {metrics['green_view_index']:.2f} | SVF: {metrics['sky_view_factor']:.2f} | Score: {metrics['visual_perception_score']:.2f}")
        results.append(metrics)
        
    df_results = pd.DataFrame(results)
    output_csv = os.path.join(OUTPUT_DIR, 'physical_environment_score.csv')
    df_results.to_csv(output_csv, index=False)
    
    elapsed = time.time() - start_time
    print(f"\n=== SELESAI ===")
    print(f"Waktu pemrosesan: {elapsed:.1f} detik")
    print(f"Hasil skor tersimpan di: {output_csv}")

if __name__ == "__main__":
    run_local_segmentation()
