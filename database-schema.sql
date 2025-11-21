
-- Whisperoo Database Schema for Supabase
-- This file contains all the database tables and policies needed for the onboarding process

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('mom', 'dad', 'caregiver', 'other');
CREATE TYPE expecting_status AS ENUM ('yes', 'no', 'trying');

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role,
  custom_role TEXT,
  expecting_status expecting_status,
  has_kids BOOLEAN DEFAULT FALSE,
  kids_count INTEGER DEFAULT 0,
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create kids table to store individual child information
CREATE TABLE kids (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  age TEXT NOT NULL, -- Store as text to allow flexible input like "5 yr", "18 months", etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);



-- Create function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_kids_updated_at
  BEFORE UPDATE ON kids
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids ENABLE ROW LEVEL SECURITY;


-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Kids policies
CREATE POLICY "Users can view own kids"
  ON kids FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Users can insert own kids"
  ON kids FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Users can update own kids"
  ON kids FOR UPDATE
  USING (auth.uid() = parent_id);

CREATE POLICY "Users can delete own kids"
  ON kids FOR DELETE
  USING (auth.uid() = parent_id);



-- Create indexes for better performance
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_kids_parent_id ON kids(parent_id);







