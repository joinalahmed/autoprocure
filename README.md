# AutoProcure - Intelligent Procurement Reconciliation System

AutoProcure is an AI-powered procurement document processing and reconciliation system that automates the three-way matching of Purchase Orders (POs), Invoices, and Goods Receipt Notes (GRNs).

## 🌟 Features

- **AI-Powered Document Extraction**: Uses OpenAI GPT-4o to extract structured data from PDF documents
- **Multi-Language Support**: Handles documents in English, Japanese, German, Swedish, and more
- **Three-Way Reconciliation**: Automatically matches POs, Invoices, and GRNs
- **Approval Workflow**: Built-in approve/reject functionality with comments
- **Real-Time Analytics**: Dashboard showing document counts, match status, and approval metrics
- **PDF Viewer**: In-app PDF viewing with modal popup
- **Responsive UI**: Modern, clean interface built with TailwindCSS
- **Collapsible Navigation**: Space-saving sidebar with icon-only mode
- **Vendor Branding**: Logo support for vendors with fallback to branded initials

## 📋 Prerequisites

- **Python 3.12+**
- **MongoDB** (local or remote instance)
- **OpenAI API Key** with GPT-4o access
- **Poppler** (for PDF to image conversion)
- **Node.js** (optional, for frontend development)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ema
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

**Required packages:**
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `pymongo` - MongoDB driver
- `openai` - OpenAI API client
- `pdf2image` - PDF processing
- `reportlab` - PDF generation
- `pydantic` - Data validation

### 3. Install System Dependencies

#### macOS (using Homebrew)
```bash
brew install poppler
```

#### Ubuntu/Debian
```bash
sudo apt-get install poppler-utils
```

#### Windows
Download and install Poppler from: https://github.com/oschwartz10612/poppler-windows/releases/

### 4. Set Up MongoDB

#### Option A: Local MongoDB
```bash
# macOS
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Ubuntu
sudo apt-get install mongodb
sudo systemctl start mongodb
```

#### Option B: MongoDB Atlas (Cloud)
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get connection string
4. Set environment variable:
```bash
export MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/"
```

### 5. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here

# MongoDB Configuration (optional, defaults shown)
MONGO_URI=mongodb://localhost:27017
MONGO_DB=ema
```

Or export directly:
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
export MONGO_URI="mongodb://localhost:27017"
export MONGO_DB="ema"
```

### 6. Generate Sample Data

```bash
cd data
python datagen.py
```

This creates 30 sample transaction sets (POs, Invoices, GRNs) in `data/simulated_data_lake/incoming/`

### 7. Process and Ingest Documents

```bash
cd ../src
python ingest_to_mongo.py asst_7LCZgEO8v9EBbFpSuCZ62sDG
```

**Note**: Replace `asst_7LCZgEO8v9EBbFpSuCZ62sDG` with your OpenAI Assistant ID if different.

This will:
- Process all PDFs in the `incoming` folder
- Extract structured data using GPT-4o
- Store in MongoDB
- Move processed files to respective folders (`purchase_orders/`, `invoices/`, `goods_receipts/`)

### 8. Start the Application

```bash
cd src/app
uvicorn app:app --host 0.0.0.0 --port 8080 --reload
```

### 9. Access the Application

Open your browser and navigate to:
```
http://localhost:8080
```

## 📁 Project Structure

```
ema/
├── data/
│   ├── datagen.py                    # PDF generator script
│   └── simulated_data_lake/
│       ├── incoming/                 # Unprocessed PDFs
│       ├── purchase_orders/          # Processed POs
│       ├── invoices/                 # Processed Invoices
│       └── goods_receipts/           # Processed GRNs
├── src/
│   ├── app/
│   │   ├── app.py                    # FastAPI application
│   │   └── static/
│   │       ├── index.html            # Main UI
│   │       └── main.js               # Frontend logic
│   ├── processor.py                  # Document extraction engine
│   └── ingest_to_mongo.py           # Ingestion script
├── requirements.txt                  # Python dependencies
└── README.md                         # This file
```

## 🔧 Configuration

### Data Generation

Edit `data/datagen.py` to customize:
- `NUM_TRANSACTIONS`: Number of transaction sets to generate (default: 30)
- `CHAOS_RATE`: Percentage of documents with intentional errors (default: 0.5 = 50%)
- Vendor catalogs, currencies, tax rates

### Document Processing

Edit `src/ingest_to_mongo.py` to customize:
- `--data-lake-path`: Path to PDF folder (default: `../data/simulated_data_lake`)
- `--limit`: Maximum number of PDFs to process (optional)
- `--mongo-uri`: MongoDB connection string
- `--db-name`: Database name

### Application Settings

Edit `src/app/app.py` to customize:
- API endpoints
- Reconciliation logic
- Decision workflow

## 🎯 Usage Guide

### Navigation

- **Reconciliation**: Three-way match dashboard with approval workflow
- **Purchase Orders**: View all POs
- **Invoices**: View all invoices
- **Goods Receipts**: View all GRNs

### Reconciliation Workflow

1. **View Status**: Each PO shows match status (Matched, Amount Mismatch, Missing Invoice/GRN, etc.)
2. **Review Details**: Click a PO to see full details, line items, and linked documents
3. **Approve/Reject**: Use action buttons to approve or reject reconciliation
4. **Add Comments**: Optional comments for audit trail
5. **Track Decisions**: View approval status in the analytics bar

### Analytics Dashboard

The top analytics bar shows:
- **Documents**: Total count of POs, Invoices, and GRNs
- **Status**: Number of matched vs. issues
- **Decisions**: Approved, Rejected, and Pending counts

### PDF Viewing

Click "View PDF" on any document to open it in a modal viewer without leaving the page.

## 🔍 Troubleshooting

### MongoDB Connection Issues

```bash
# Check if MongoDB is running
mongosh

# If using Atlas, verify connection string
mongosh "mongodb+srv://cluster.mongodb.net/" --username <user>
```

### OpenAI API Errors

```bash
# Verify API key is set
echo $OPENAI_API_KEY

# Test API access
python -c "from openai import OpenAI; print(OpenAI().models.list())"
```

### PDF Processing Errors

```bash
# Verify Poppler installation
pdftoppm -v

# macOS: Reinstall if needed
brew reinstall poppler
```

### Port Already in Use

```bash
# Find process using port 8080
lsof -i :8080

# Kill the process
kill -9 <PID>

# Or use a different port
uvicorn app:app --port 8081
```

## 🧪 Development

### Running in Development Mode

```bash
# Backend with auto-reload
cd src/app
uvicorn app:app --reload --host 0.0.0.0 --port 8080

# Watch for file changes
# The --reload flag automatically restarts on code changes
```

### Adding New Document Types

1. Update `src/processor.py` to add new `DocumentType` enum
2. Create Pydantic model for the document structure
3. Update `src/ingest_to_mongo.py` collection mapping
4. Add UI rendering in `src/app/static/main.js`

### Customizing Reconciliation Logic

Edit `src/app/app.py` in the `/api/reconciliation` endpoint:
- Modify matching criteria
- Add new validation rules
- Implement custom business logic

## 📊 Database Schema

### Collections

#### `purchase_orders`
```json
{
  "_id": ObjectId,
  "document_type": "purchase_order",
  "source_pdf_path": "/path/to/PO-12345.pdf",
  "purchase_order": {
    "po_number": "PO-12345",
    "date": "2024-12-01",
    "vendor": { "name": "...", "country": "..." },
    "items": [...],
    "grand_total": 1000.00
  }
}
```

#### `invoices`
```json
{
  "_id": ObjectId,
  "document_type": "invoice",
  "source_pdf_path": "/path/to/INV-67890.pdf",
  "invoice": {
    "invoice_number": "INV-67890",
    "reference_po": "PO-12345",
    "vendor": { "name": "...", "country": "..." },
    "items": [...],
    "grand_total": 1000.00
  }
}
```

#### `goods_receipts`
```json
{
  "_id": ObjectId,
  "document_type": "goods_receipt_note",
  "source_pdf_path": "/path/to/GRN-12345.pdf",
  "goods_receipt": {
    "grn_number": "GRN-12345",
    "reference_po": "PO-12345",
    "items": [...]
  }
}
```

#### `reconciliation_decisions`
```json
{
  "_id": ObjectId,
  "po_number": "PO-12345",
  "decision": "approved",
  "comment": "All documents match",
  "timestamp": "2024-12-06T01:00:00Z",
  "user": "JA"
}
```

## 🔐 Security Considerations

- **API Keys**: Never commit API keys to version control
- **MongoDB**: Use authentication in production
- **CORS**: Configure allowed origins in production
- **File Uploads**: Validate and sanitize file paths
- **User Auth**: Implement authentication for production use

## 🚀 Production Deployment

### Using Docker (Recommended)

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y poppler-utils

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY src/ ./src/
COPY data/ ./data/

# Expose port
EXPOSE 8080

# Run application
CMD ["uvicorn", "src.app.app:app", "--host", "0.0.0.0", "--port", "8080"]
```

Build and run:
```bash
docker build -t autoprocure .
docker run -p 8080:8080 -e OPENAI_API_KEY=$OPENAI_API_KEY autoprocure
```

### Environment Variables for Production

```bash
OPENAI_API_KEY=sk-prod-key
MONGO_URI=mongodb+srv://prod-cluster.mongodb.net/
MONGO_DB=autoprocure_prod
```

## 📝 License

[Your License Here]

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues and questions:
- Create an issue on GitHub

## 🙏 Acknowledgments

- OpenAI for GPT-4o API
- FastAPI for the excellent web framework
- ReportLab for PDF generation
- TailwindCSS for UI styling

---

**Built with ❤️ for modern procurement teams**
