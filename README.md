# buildathon-project
## how to run this script

### execute command to set llm key
#export OPENAI_API_KEY="API_KEY"

### syntax is : node / executable / input_file / output_file

### classify. this takes wrodium.txt and classifies it into a score
#node classify-aeo.mjs wrodium.txt > wrodium.json 

### improve. then we take the original wrodium.json and improve it with improve-aeo.mjs
#node improve-aeo.mjs wrodium.json wrodium.txt -o wrodium-revised.txt

### reclassify. This classifies the revised article and saves the JSON output to wrodium-revised-aeo.json.
#node classify-aeo.mjs wrodium-revised.txt > wrodium-revised-aeo.json

### finally, compare the two jsons to see the changes
#node compare-aeo.mjs wrodium.json wrodium-revised-aeo.json