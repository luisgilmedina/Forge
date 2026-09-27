package com.focusforge.study;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

/** Reads cell values from the first three XLSX worksheets. Never executes formulas or macros. */
final class SpreadsheetReader {
    private static final int ENTRY_LIMIT = 3_000_000;
    private static final int TOTAL_LIMIT = 8_000_000;
    private SpreadsheetReader() { }

    static String read(byte[] archive) throws Exception {
        if (archive.length > 2_000_000) throw new IOException("Archivo demasiado grande");
        byte[] shared = null;
        Map<String, byte[]> sheets = new TreeMap<>();
        int total = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(archive))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                boolean strings = name.equals("xl/sharedStrings.xml");
                boolean sheet = name.matches("xl/worksheets/sheet[0-9]+\\.xml") && sheets.size() < 3;
                if (!strings && !sheet) { zip.closeEntry(); continue; }
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192]; int length;
                while ((length = zip.read(buffer)) != -1) {
                    if (output.size() + length > ENTRY_LIMIT || total + length > TOTAL_LIMIT)
                        throw new IOException("Contenido XLSX demasiado grande");
                    output.write(buffer, 0, length); total += length;
                }
                if (strings) shared = output.toByteArray();
                else sheets.put(name, output.toByteArray());
                zip.closeEntry();
            }
        }
        if (sheets.isEmpty()) throw new IOException("No hay hojas compatibles");
        List<String> dictionary = new ArrayList<>();
        if (shared != null) {
            NodeList nodes = parse(shared).getElementsByTagNameNS("*", "si");
            for (int i = 0; i < nodes.getLength() && i < 20000; i++)
                dictionary.add(nodes.item(i).getTextContent());
        }
        StringBuilder text = new StringBuilder();
        for (Map.Entry<String, byte[]> sheet : sheets.entrySet()) {
            text.append("\n").append(sheet.getKey()).append("\n");
            NodeList rows = parse(sheet.getValue()).getElementsByTagNameNS("*", "row");
            for (int i = 0; i < rows.getLength() && i < 120 && text.length() < 34000; i++) {
                Element row = (Element) rows.item(i);
                NodeList cells = row.getElementsByTagNameNS("*", "c");
                TreeMap<Integer, String> values = new TreeMap<>();
                for (int j = 0; j < cells.getLength() && j < 50; j++) {
                    Element cell = (Element) cells.item(j);
                    int column = column(cell.getAttribute("r"));
                    if (column < 0 || column >= 24) continue;
                    String content = cellValue(cell, dictionary).replace('\n', ' ').replace('\t', ' ').trim();
                    if (!content.isEmpty()) values.put(column, content.substring(0, Math.min(300, content.length())));
                }
                if (values.isEmpty()) continue;
                int last = Math.min(23, values.lastKey());
                for (int j = 0; j <= last; j++) {
                    if (j > 0) text.append(" | ");
                    text.append(values.getOrDefault(j, ""));
                }
                text.append('\n');
            }
        }
        String result = text.toString().trim();
        if (result.isEmpty()) throw new IOException("Sin celdas con texto");
        return result.substring(0, Math.min(result.length(), 35000));
    }

    private static Document parse(byte[] xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
    }

    private static String cellValue(Element cell, List<String> dictionary) {
        NodeList values = cell.getElementsByTagNameNS("*", "v");
        if ("inlineStr".equals(cell.getAttribute("t"))) {
            NodeList inline = cell.getElementsByTagNameNS("*", "is");
            return inline.getLength() > 0 ? inline.item(0).getTextContent() : "";
        }
        if (values.getLength() == 0) return "";
        String value = values.item(0).getTextContent();
        if (!"s".equals(cell.getAttribute("t"))) return value;
        try { int index = Integer.parseInt(value); return index >= 0 && index < dictionary.size() ? dictionary.get(index) : ""; }
        catch (NumberFormatException e) { return ""; }
    }

    private static int column(String address) {
        int result = 0, i = 0;
        while (i < address.length() && address.charAt(i) >= 'A' && address.charAt(i) <= 'Z') {
            result = result * 26 + address.charAt(i++) - 'A' + 1;
            if (result > 24) return -1;
        }
        return i == 0 ? -1 : result - 1;
    }
}
