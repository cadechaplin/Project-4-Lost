def create_network():
    data = {}
    data["distance_matrix"] = [
        [0, 1.388, 0.821, 1.616, 0.677, 1.680, 1.677, 4.381, 1.104, 0.762, 2.098, 2.771, 0.924, 1.362, 2.149, 0.867],
        [1.388, 0, 0.959, 2.247, 2.005, 1.814, 1.017, 2.759, 0.606, 2.061, 2.168, 1.144, 0.703, 1.114, 0.697, 1.716],      
        [0.821, 0.959, 0, 2.436, 1.714, 0.859, 0.856, 3.282, 1.562, 1.585, 1.272, 2.100, 0.590, 2.184, 1.328, 1.689],      
        [1.616, 2.247, 2.436, 0, 2.670, 3.295, 3.291, 4.770, 1.993, 1.041, 3.704, 3.160, 2.535, 1.234, 3.028, 1.146],      
        [0.677, 2.005, 1.714, 2.670, 0, 2.358, 2.354, 5.059, 1.781, 1.439, 2.775, 3.449, 1.761, 2.040, 2.826, 1.544],      
        [1.680, 1.814, 0.859, 3.295, 2.358, 0, 1.735, 4.399, 2.445, 2.463, 1.501, 2.983, 1.469, 3.063, 2.207, 2.567],      
        [1.677, 1.017, 0.856, 3.291, 2.354, 1.735, 0, 2.450, 1.623, 2.440, 1.088, 2.254, 0.936, 2.131, 0.664, 2.049],      
        [4.381, 2.759, 3.282, 4.770, 5.059, 4.399, 2.450, 0, 2.942, 5.020, 3.233, 1.614, 3.367, 3.533, 2.318, 4.378],      
        [1.104, 0.606, 1.562, 1.993, 1.781, 2.445, 1.623, 2.942, 0, 1.739, 2.777, 1.327, 0.903, 0.792, 1.306, 1.395],      
        [0.762, 2.061, 1.585, 1.041, 1.439, 2.463, 2.440, 5.020, 1.739, 0, 2.853, 3.410, 1.685, 1.794, 2.773, 0.743],      
        [2.098, 2.168, 1.272, 3.704, 2.775, 1.501, 1.088, 3.233, 2.777, 2.853, 0, 3.037, 1.431, 2.521, 1.447, 2.960],      
        [2.771, 1.144, 2.100, 3.160, 3.449, 2.983, 2.254, 1.614, 1.327, 3.410, 3.037, 0, 1.844, 1.923, 2.112, 2.768],      
        [0.924, 0.703, 0.590, 2.535, 1.761, 1.469, 0.936, 3.367, 0.903, 1.685, 1.431, 1.844, 0, 1.105, 1.072, 1.128],      
        [1.362, 1.114, 2.184, 1.234, 2.040, 3.063, 2.131, 3.533, 0.792, 1.794, 2.521, 1.923, 1.105, 0, 1.791, 0.845],      
        [2.149, 0.697, 1.328, 3.028, 2.826, 2.207, 0.664, 2.318, 1.306, 2.773, 1.447, 2.112, 1.072, 1.791, 0, 2.413],      
        [0.867, 1.716, 1.689, 1.146, 1.544, 2.567, 2.049, 4.378, 1.395, 0.743, 2.960, 2.768, 1.128, 0.845, 2.413, 0]  
    ]
    
    data["num_vehicles"] = 1
    data["depot"] = 0
    return data


# Nodes in road network based on these real world coordinates:
# https://www.google.com/maps/d/edit?mid=16N6qsgZBDZ8dU02f0eHBUjNRXNmN6QY&usp=sharing