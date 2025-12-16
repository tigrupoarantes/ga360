-- Fix function search paths for security
ALTER FUNCTION public.calculate_level(INTEGER) SET search_path = public;
ALTER FUNCTION public.add_user_points(UUID, INTEGER, TEXT, TEXT, UUID, TEXT) SET search_path = public;